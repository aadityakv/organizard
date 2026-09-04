// Sync engine for shared moves: flush the outbox, then pull deltas. Scheduled
// on mount, app-foreground, reconnect, and a ~15s poll. Dormant for local moves.
//
// Every store write is guarded against a mid-flight move switch: the network
// calls below can take minutes (uploads, paged pulls), and an unguarded write
// would land move A's data in move B's live slice or clobber B's sync cursor.
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { api, ApiError } from '@/lib/api';
import { uploadPendingPhotos } from '@/services/photos';
import { clearSession } from '@/lib/session';
import { useStore } from '@/store/useStore';
import { MOVE_MODE } from '@/store/library';

const POLL_MS = 15_000;
const MAX_BACKOFF_MS = 60_000;
const FLUSH_CHUNK = 200; // well under the server's 500/batch cap
const MAX_PAGES = 50;

let syncing = false;
let pendingFull = false; // a full-resync was requested; consumed at the start of the next pass
let failures = 0;
let nextAllowedAt = 0;

/** True while the store still shows the move this pass started for. */
const stillOn = (serverMoveId: string): boolean => useStore.getState().serverMoveId === serverMoveId;

/** One sync pass: flush pending mutations (in order), then merge the delta. Returns false when anything failed. */
export async function syncActiveMove(): Promise<boolean> {
  const st = useStore.getState();
  if (st.activeMode !== MOVE_MODE.shared || !st.serverMoveId || !st.session || syncing) return true;
  if (Date.now() < nextAllowedAt) return true; // backing off after repeated failures

  syncing = true;
  if (pendingFull) {
    pendingFull = false;
    useStore.getState().resetSyncCursor(); // consumed inside the mutex, so it can't be clobbered
  }
  const { session, serverMoveId } = st;
  try {
    // Flush in chunks so one request never hits the 500/batch cap. A 400 means the
    // server rejected the chunk's shape; retry one-by-one so a single poison
    // mutation costs only itself, not the other 199 offline edits.
    const pending = useStore.getState().outbox;
    for (let i = 0; i < pending.length; i += FLUSH_CHUNK) {
      const chunk = pending.slice(i, i + FLUSH_CHUNK);
      try {
        await api.mutations(session, serverMoveId, chunk);
        if (stillOn(serverMoveId)) useStore.getState().clearOutbox(chunk.map((m) => m.clientId));
      } catch (e) {
        if (e instanceof ApiError && e.status === 400) {
          for (const m of chunk) {
            try {
              await api.mutations(session, serverMoveId, [m]);
              if (stillOn(serverMoveId)) useStore.getState().clearOutbox([m.clientId]);
            } catch (e2) {
              if (e2 instanceof ApiError && e2.status === 400) {
                // Poison entry: drop it rather than wedge the outbox forever.
                if (stillOn(serverMoveId)) useStore.getState().clearOutbox([m.clientId]);
                console.warn('sync: dropped rejected mutation', m.type, m.clientId);
              } else {
                throw e2; // transient mid-salvage; the rest retries next pass
              }
            }
          }
        } else if (e instanceof ApiError && e.status === 403 && e.code === 'FORBIDDEN_ROLE') {
          // Role downgraded below the mutation's requirement (e.g. editor → viewer
          // with offline edits queued): those can never flush as-is. Keep them in
          // the outbox in case the role is restored, skip the rest of the flush,
          // and still pull — a viewer may read.
          break;
        } else {
          throw e; // transient/401/402 -> outer handler; remaining chunks retry next pass
        }
      }
      if (!stillOn(serverMoveId)) return true; // user switched moves mid-flush
    }
    // Upload local-uri photos to R2 before pulling, so the delta carries their ids.
    await uploadPendingPhotos();
    if (!stillOn(serverMoveId)) return true;
    // Pull deltas, paging through if the change set was capped.
    let guard = 0;
    let more = true;
    let lastSince = -1;
    while (more && guard++ < MAX_PAGES) {
      const since = useStore.getState().lastSyncTs;
      if (since <= lastSince) break; // cursor can't advance (dirty-row holdback) — don't loop
      lastSince = since;
      const changes = await api.changes(session, serverMoveId, since);
      if (!stillOn(serverMoveId)) return true; // switched mid-pull: drop the page, don't cross-contaminate
      useStore.getState().applyChanges(changes);
      more = changes.hasMore;
    }
    failures = 0;
    nextAllowedAt = 0;
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      // The token is dead, the data is not: keep the moves (and their outboxes) so the
      // next sign-in flushes what was captured offline.
      useStore.getState().expireSession();
      void clearSession();
    } else if (e instanceof ApiError && e.status === 404 && e.code === 'NOT_FOUND') {
      // The app's own NOT_FOUND (not a proxy/gateway 404): this account can no longer
      // see the server move (deleted, or a bundle left over from a previous account).
      // Park it as local-only — the data survives, sync stops, because retrying can
      // never succeed. Guarded so a failure for a move we already left alone can't
      // park the move that's open now.
      if (stillOn(serverMoveId)) useStore.getState().parkServerMove();
      return true;
    } else {
      // Transient/network: keep the outbox and back off exponentially (with jitter).
      failures += 1;
      nextAllowedAt =
        Date.now() + Math.min(MAX_BACKOFF_MS, 1000 * 2 ** failures) + Math.floor(Math.random() * 1000);
    }
    return false;
  } finally {
    syncing = false;
  }
}

async function fullResync(): Promise<void> {
  const st = useStore.getState();
  if (st.activeMode !== MOVE_MODE.shared || !st.serverMoveId || !st.session) return;
  pendingFull = true; // consumed by syncActiveMove inside its mutex (survives an in-flight pass)
  await syncActiveMove();
}

/** Pull the account's shared moves into the local library without opening them. */
export async function pullServerMoves(): Promise<void> {
  const { session, account } = useStore.getState();
  if (!session) return;
  let me: Awaited<ReturnType<typeof api.me>>;
  try {
    me = await api.me(session);
  } catch {
    return; // offline / transient — the move will still appear next sync trigger
  }
  // Keep the stored account's entitlement in step with the server (webhook grants
  // and lapses reach a signed-in client this way, not just at sign-in).
  if (account && me.user.entitlementActive !== account.entitlementActive) {
    useStore.getState().setSession(session, { ...account, entitlementActive: me.user.entitlementActive });
  }
  for (const m of me.moves) {
    const lib = useStore.getState().library;
    if (Object.values(lib).some((b) => b.serverMoveId === m.id)) continue;
    // A share interrupted between createMove and persisting the link leaves the
    // local move unattached while its server twin exists: adopt it (by the
    // server move's clientId = the local move id) instead of duplicating.
    const localTwin = m.clientId
      ? Object.values(lib).find((b) => !b.serverMoveId && b.id === m.clientId)
      : undefined;
    if (localTwin) {
      useStore.getState().adoptSharedMove(localTwin.id, m.id);
      continue;
    }
    try {
      const snap = await api.snapshot(session, m.id);
      useStore.getState().importSharedMove(m.id, snap);
    } catch (e) {
      console.warn('pullServerMoves: snapshot failed', m.id, e);
    }
  }
}

/** Wire sync triggers for the lifetime of the component (mount it once, high up). */
export function useSync(): void {
  const activeMode = useStore((s) => s.activeMode);
  const serverMoveId = useStore((s) => s.serverMoveId);
  const session = useStore((s) => s.session);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (activeMode !== MOVE_MODE.shared || !serverMoveId || !session) return;

    void syncActiveMove();
    timer.current = setInterval(() => void syncActiveMove(), POLL_MS);
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void fullResync(); // foreground = full re-pull (backstop)
    });
    const netUnsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) void syncActiveMove();
    });

    return () => {
      if (timer.current) clearInterval(timer.current);
      appSub.remove();
      netUnsub();
    };
  }, [activeMode, serverMoveId, session]);
}
