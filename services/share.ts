// The "share this move" upgrade: create an empty server move, replay the local
// move as one mutation batch (keeping ids), then flip the move to shared mode.
import type { Role } from '@/shared';

import { api } from '@/lib/api';
import { buildShareReplayBatch } from '@/lib/shareReplay';
import { clearSession } from '@/lib/session';
import { syncActiveMove } from '@/services/sync';
import { extractSlice } from '@/store/shape';
import { useStore } from '@/store/useStore';
import { MOVE_MODE } from '@/store/library';

/** Upgrade the active local move to shared. Requires a signed-in session. */
export async function shareMove(): Promise<{ moveId: string }> {
  const s = useStore.getState();
  if (!s.session) throw new Error('Sign in first');
  if (s.activeMode === MOVE_MODE.shared && s.serverMoveId) return { moveId: s.serverMoveId };
  const localId = s.currentMoveId;

  const snap = await api.createMove(s.session, {
    name: s.move.name,
    from: s.move.from || null,
    to: s.move.to || null,
    targetDate: s.move.target || null,
    seed: false, // we replay our own statuses/markers
    // The local move's id: if a previous attempt died between createMove and the
    // link persisting, the server reuses that move instead of minting a duplicate.
    clientId: localId ?? undefined,
  });
  const serverMoveId = snap.move.id;

  // Flip to shared, then queue the whole inventory as the first entries in the outbox.
  // Going through the outbox (not a direct post) means a dropped connection here leaves
  // nothing half-done: the batch is persisted and retried like any other edit, ahead of
  // anything captured afterwards.
  useStore.getState().goShared(serverMoveId);
  for (const m of buildShareReplayBatch(extractSlice(useStore.getState()))) useStore.getState().enqueue(m);
  void syncActiveMove();
  return { moveId: serverMoveId };
}

/** Push every local (guest) move to the server so a signed-in user's moves are all synced. */
export async function syncLocalMovesUp(): Promise<void> {
  if (!useStore.getState().session) return;
  const startId = useStore.getState().currentMoveId;
  const localIds = Object.values(useStore.getState().library)
    .filter((b) => b.activeMode === MOVE_MODE.local)
    .map((b) => b.id);
  for (const id of localIds) {
    try {
      useStore.getState().switchMove(id);
      await shareMove();
    } catch (e) {
      console.warn('syncLocalMovesUp: failed for', id, e); // stays local; retried later
    }
  }
  if (startId && useStore.getState().library[startId]) useStore.getState().switchMove(startId);
}

/** Flush the open move while still authenticated, then sign out. */
export async function flushAndSignOut(): Promise<void> {
  // signOut drops synced bundles — outbox included — so every OTHER shared move
  // with queued offline edits must be flushed too, or those edits are lost.
  const startId = useStore.getState().currentMoveId;
  const dirtyShared = Object.values(useStore.getState().library).filter(
    (b) => b.serverMoveId && b.id !== startId && b.outbox.length > 0,
  );
  for (const b of dirtyShared) {
    useStore.getState().switchMove(b.id);
    await syncActiveMove();
  }
  if (startId && dirtyShared.length) {
    const back = useStore.getState().library[startId] ? startId : null;
    if (back) useStore.getState().switchMove(back);
  }

  const ok = await syncActiveMove();
  if (!ok) console.warn('signOut: final sync failed; recent offline edits stay queued for next sign-in');
  const session = useStore.getState().session;
  if (session) await api.logout(session).catch(() => {}); // best-effort server-side revoke
  useStore.getState().signOut();
  await clearSession();
}

/** Owner creates a shareable invite link for the active shared move. */
export async function createInviteLink(role: Role): Promise<string> {
  const s = useStore.getState();
  if (!s.session || !s.serverMoveId) throw new Error('Move is not shared');
  const res = await api.createInvite(s.session, s.serverMoveId, role);
  return res.url;
}
