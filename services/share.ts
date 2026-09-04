// The "share this move" upgrade: create an empty server move, replay the local
// move as one mutation batch (keeping ids), then flip the move to shared mode.
import type { Role } from '@/shared';

import { api } from '@/lib/api';
import { buildMigrationBatch } from '@/lib/migration';
import { clearSession } from '@/lib/session';
import { setMigrating, syncActiveMove } from '@/services/sync';
import { extractSlice } from '@/store/shape';
import { useStore } from '@/store/useStore';

/** Upgrade the active local move to shared. Requires a signed-in session. */
export async function shareMove(): Promise<{ moveId: string }> {
  const s = useStore.getState();
  if (!s.session) throw new Error('Sign in first');
  if (s.activeMode === 'shared' && s.serverMoveId) return { moveId: s.serverMoveId };

  const snap = await api.createMove(s.session, {
    name: s.move.name,
    from: s.move.from || null,
    to: s.move.to || null,
    targetDate: s.move.target || null,
    seed: false, // we replay our own statuses/markers
  });
  const serverMoveId = snap.move.id;

  // Hold sync during the migration so concurrent edits can't flush before the batch
  // creates their rooms/boxes. Flip to shared FIRST so those edits enqueue (not no-op'd).
  setMigrating(true);
  try {
    useStore.getState().goShared(serverMoveId);
    const batch = buildMigrationBatch(extractSlice(useStore.getState()));
    if (batch.length) await api.mutations(s.session, serverMoveId, batch);
  } finally {
    setMigrating(false);
  }
  void syncActiveMove(); // flush anything captured during the migration
  return { moveId: serverMoveId };
}

/** Push every local (guest) move to the server so a signed-in user's moves are all synced. */
export async function syncLocalMovesUp(): Promise<void> {
  if (!useStore.getState().session) return;
  const startId = useStore.getState().currentMoveId;
  const localIds = Object.values(useStore.getState().library)
    .filter((b) => b.activeMode === 'local')
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
  try {
    await syncActiveMove();
  } catch (e) {
    console.warn('signOut: final sync failed; recent offline edits may not have saved', e);
  }
  useStore.getState().signOut();
  void clearSession();
}

/** Owner creates a shareable invite link for the active shared move. */
export async function createInviteLink(role: Role): Promise<string> {
  const s = useStore.getState();
  if (!s.session || !s.serverMoveId) throw new Error('Move is not shared');
  const res = await api.createInvite(s.session, s.serverMoveId, role);
  return res.url;
}
