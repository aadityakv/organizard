// The "share this move" upgrade: create an empty server move, replay the local
// move as one mutation batch (keeping ids), then flip the move to shared mode.
import type { Mutation, Role } from '@/shared';

import { api } from '@/lib/api';
import { uid } from '@/lib/uid';
import { setMigrating, syncActiveMove } from '@/store/sync';
import { useStore } from '@/store/useStore';

/** Mutations that recreate the active local move on the server (ids preserved). */
export function buildMigrationBatch(): Mutation[] {
  const s = useStore.getState();
  const out: Mutation[] = [];
  const ts = Date.now();
  const cid = () => uid('mig');

  for (const st of s.statuses)
    out.push({
      type: 'addStatus',
      clientId: cid(),
      ts,
      payload: { id: st.id, label: st.label, color: st.color },
    });
  for (const mk of s.markers)
    out.push({
      type: 'addMarker',
      clientId: cid(),
      ts,
      payload: { id: mk.id, label: mk.label, color: mk.color, icon: mk.icon },
    });
  for (const r of s.rooms)
    out.push({
      type: 'addRoom',
      clientId: cid(),
      ts,
      payload: { id: r.id, name: r.name, dest: r.dest ?? null, icon: r.icon },
    });
  for (const b of s.boxes) {
    out.push({
      type: 'addBox',
      clientId: cid(),
      ts,
      payload: {
        id: b.id,
        roomId: b.roomId,
        number: b.number,
        name: b.name,
        color: b.color,
        statusId: b.status,
      },
    });
    for (const markerId of b.markers)
      out.push({ type: 'setBoxMarker', clientId: cid(), ts, payload: { boxId: b.id, markerId, on: true } });
  }
  for (const [boxId, items] of Object.entries(s.itemsByBox)) {
    for (const it of items) {
      out.push({
        type: 'addItem',
        clientId: cid(),
        ts,
        payload: {
          id: it.id,
          boxId,
          name: it.name,
          qty: it.qty,
          valueCents: Math.round((it.value || 0) * 100),
          note: it.note ?? null,
          icon: it.icon ?? null,
          markerIds: it.markers ?? [],
          photoIds: [],
        },
      });
    }
  }
  return out;
}

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
    const batch = buildMigrationBatch();
    if (batch.length) await api.mutations(s.session, serverMoveId, batch);
  } finally {
    setMigrating(false);
  }
  void syncActiveMove(); // flush anything captured during the migration
  return { moveId: serverMoveId };
}

/**
 * Push every local (guest) move up to the server so a signed-in user's moves are all
 * synced/backed up ("synced by default"). Reuses shareMove by briefly switching to each
 * local move; the original move is restored afterward. A push that fails (offline) leaves
 * that move local and it retries on the next call. No-op when signed out.
 */
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

/**
 * Sign out safely: flush the open move's pending edits while still authenticated, then
 * clear the session (which drops synced moves from the device — they live in the cloud).
 */
export async function flushAndSignOut(): Promise<void> {
  try {
    await syncActiveMove();
  } catch (e) {
    console.warn('signOut: final sync failed; recent offline edits may not have saved', e);
  }
  useStore.getState().signOut();
}

/** Owner creates a shareable invite link for the active shared move. */
export async function createInviteLink(role: Role): Promise<string> {
  const s = useStore.getState();
  if (!s.session || !s.serverMoveId) throw new Error('Move is not shared');
  const res = await api.createInvite(s.session, s.serverMoveId, role);
  return res.url;
}
