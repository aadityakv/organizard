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
let syncing = false;
let failures = 0;
let nextAllowedAt = 0;

/** One sync pass: flush pending mutations (in order), then merge the delta. */
export async function syncActiveMove(): Promise<void> {
  const st = useStore.getState();
  if (st.activeMode !== 'shared' || !st.serverMoveId || !st.session || syncing) return;
  if (Date.now() < nextAllowedAt) return; // backing off after repeated failures

  syncing = true;
  const { session, serverMoveId } = st;
  try {
    const pending = useStore.getState().outbox;
    if (pending.length) {
      await api.mutations(session, serverMoveId, pending);
      useStore.getState().clearOutbox(pending.map((m) => m.clientId));
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
      nextAllowedAt = Date.now() + Math.min(MAX_BACKOFF_MS, 1000 * 2 ** failures) + Math.floor(Math.random() * 1000);
    }
  } finally {
    syncing = false;
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
      if (s === 'active') void syncActiveMove();
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
