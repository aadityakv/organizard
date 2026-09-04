// Move-level operations that need the network as well as the store.
import { api } from '@/lib/api';
import { roleFor } from '@/store/library';
import { moveData, useStore } from '@/store/useStore';

/** Delete a move; an owned shared move is torn down on the server first (failure is logged, local removal still happens). */
export async function deleteMove(id: string): Promise<void> {
  const s = useStore.getState();
  const data = moveData(s, id);
  if (!data) return;
  const ownsSharedCopy =
    data.activeMode === 'shared' &&
    data.serverMoveId != null &&
    roleFor('shared', data.members, s.account?.id ?? null) === 'owner';
  if (ownsSharedCopy && s.session && data.serverMoveId) {
    try {
      await api.deleteMove(s.session, data.serverMoveId);
    } catch (e) {
      console.warn('deleteMove: server teardown failed; removing locally', e);
    }
  }
  useStore.getState().removeMoveLocal(id);
}
