// Sync engine for shared moves: flush the outbox, then pull deltas. Scheduled
// on mount, app-foreground, reconnect, and a ~15s poll. Dormant for local moves.
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { api, ApiError } from '@/lib/api';
import { useStore } from './useStore';

const POLL_MS = 15_000;
let syncing = false;

/** One sync pass: flush pending mutations (in order), then merge the delta. */
export async function syncActiveMove(): Promise<void> {
  const st = useStore.getState();
  if (st.activeMode !== 'shared' || !st.serverMoveId || !st.session || syncing) return;

  syncing = true;
  const { session, serverMoveId } = st;
  try {
    const pending = useStore.getState().outbox;
    if (pending.length) {
      await api.mutations(session, serverMoveId, pending);
      useStore.getState().clearOutbox(pending.map((m) => m.clientId));
    }
    const changes = await api.changes(session, serverMoveId, useStore.getState().lastSyncTs);
    useStore.getState().applyChanges(changes);
  } catch (e) {
    // Transient/network: keep the outbox and retry next tick.
    if (e instanceof ApiError && e.status === 401) useStore.getState().signOut();
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
