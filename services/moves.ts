// Move-level operations that need the network as well as the store.
import { api } from '@/lib/api';
import { MOVE_MODE, roleFor } from '@/store/library';
import { moveData, useStore } from '@/store/useStore';
import { ROLES } from '@/shared';

/** Delete a move; an owned shared move is torn down on the server first (failure is logged, local removal still happens). */
export async function deleteMove(id: string): Promise<void> {
  const s = useStore.getState();
  const data = moveData(s, id);
  if (!data) return;
  const ownsSharedCopy =
    data.activeMode === MOVE_MODE.shared &&
    data.serverMoveId != null &&
    roleFor(MOVE_MODE.shared, data.members, s.account?.id ?? null) === ROLES.owner;
  if (ownsSharedCopy && s.session && data.serverMoveId) {
    try {
      await api.deleteMove(s.session, data.serverMoveId);
    } catch (e) {
      console.warn('deleteMove: server teardown failed; removing locally', e);
    }
  }
  useStore.getState().removeMoveLocal(id);
}
