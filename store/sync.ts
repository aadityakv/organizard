// Sync engine for shared moves: flush the outbox, then pull deltas. Scheduled
// on mount, app-foreground, reconnect, and a ~15s poll. Dormant for local moves.
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { api, ApiError } from '@/lib/api';
import { uploadPendingPhotos } from '@/lib/photos';
import { useStore } from './useStore';

const POLL_MS = 15_000;
const MAX_BACKOFF_MS = 60_000;
const FLUSH_CHUNK = 200; // well under the server's 500/batch cap
let syncing = false;
let migrating = false; // share-upgrade in progress: hold sync so it can't flush before the migration batch
let pendingFull = false; // a full-resync was requested; consumed at the start of the next pass
let failures = 0;
let nextAllowedAt = 0;

/** Pause/resume sync around the local→shared migration (so edits aren't flushed before their entities exist). */
export const setMigrating = (v: boolean): void => {
  migrating = v;
};

/** One sync pass: flush pending mutations (in order), then merge the delta. */
export async function syncActiveMove(): Promise<void> {
  const st = useStore.getState();
  if (st.activeMode !== 'shared' || !st.serverMoveId || !st.session || syncing || migrating) return;
  if (Date.now() < nextAllowedAt) return; // backing off after repeated failures

  syncing = true;
  if (pendingFull) {
    pendingFull = false;
    useStore.setState({ lastSyncTs: 0 }); // consumed inside the mutex, so it can't be clobbered
  }
  const { session, serverMoveId } = st;
  try {
    // Flush in chunks so one request never hits the 500/batch cap, and a 400 only
    // ever drops ONE chunk (poison/legacy) instead of the whole offline session.
    const pending = useStore.getState().outbox;
    for (let i = 0; i < pending.length; i += FLUSH_CHUNK) {
      const chunk = pending.slice(i, i + FLUSH_CHUNK);
      try {
        await api.mutations(session, serverMoveId, chunk);
        useStore.getState().clearOutbox(chunk.map((m) => m.clientId));
      } catch (e) {
        if (e instanceof ApiError && e.status === 400) {
          useStore.getState().clearOutbox(chunk.map((m) => m.clientId)); // drop the bad chunk; don't wedge
        } else {
          throw e; // transient/401/402 -> outer handler; remaining chunks retry next pass
        }
      }
    }
    // Upload local-uri photos to R2 before pulling, so the delta carries their ids.
    await uploadPendingPhotos();
    // Pull deltas, paging through if the change set was capped.
    let guard = 0;
    let more = true;
    while (more && guard++ < 50) {
      const changes = await api.changes(session, serverMoveId, useStore.getState().lastSyncTs);
      useStore.getState().applyChanges(changes);
      more = changes.hasMore;
    }
    failures = 0;
    nextAllowedAt = 0;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      useStore.getState().signOut(); // session gone — stop syncing
    } else {
      // Transient/network: keep the outbox and back off exponentially (with jitter).
      failures += 1;
      nextAllowedAt =
        Date.now() + Math.min(MAX_BACKOFF_MS, 1000 * 2 ** failures) + Math.floor(Math.random() * 1000);
    }
  } finally {
    syncing = false;
  }
}

/** Force a full re-pull (resets the cursor). The backstop that heals any delta the
 * unbounded sync could have missed under a rare concurrent-writer race. */
export async function fullResync(): Promise<void> {
  const st = useStore.getState();
  if (st.activeMode !== 'shared' || !st.serverMoveId || !st.session) return;
  pendingFull = true; // consumed by syncActiveMove inside its mutex (survives an in-flight pass)
  await syncActiveMove();
}

/**
 * After sign-in, pull the account's shared moves into the local library so they
 * appear on this device (without disturbing the currently-open move). Best-effort:
 * a failed snapshot for one move just skips it.
 */
export async function pullServerMoves(): Promise<void> {
  const { session } = useStore.getState();
  if (!session) return;
  let moves: { id: string }[];
  try {
    ({ moves } = await api.me(session));
  } catch {
    return; // offline / transient — the move will still appear next sync trigger
  }
  for (const m of moves) {
    const lib = useStore.getState().library;
    if (Object.values(lib).some((b) => b.serverMoveId === m.id)) continue;
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
    if (activeMode !== 'shared' || !serverMoveId || !session) return;

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
