// The library of moves. Opening a move copies its bundle into the live slice; leaving
// it (createMove / switchMove / removeMoveLocal) parks the live slice back first.
import type { StateCreator } from 'zustand';

import { uid } from '@/lib/uid';

import { newBundle, sliceFromBundle } from '../library';
import { emptyLiveSlice, parkCurrentMove } from '../shape';
import { bundleFromSnapshot } from '../snapshot';
import type { LibraryActions, Store } from '../types';

export type LibrarySlice = StateCreator<Store, [['zustand/persist', unknown]], [], LibraryActions>;

/** Actions that manage the library of moves. */
export const createLibrarySlice: LibrarySlice = (set) => ({
  createMove: ({ name, from = '', to = '', target = '' }) => {
    const id = uid('mv');
    const now = Date.now();
    const bundle = newBundle(id, { name, from, to, target }, now);
    set((s) => ({
      library: { ...parkCurrentMove(s, now), [id]: bundle },
      currentMoveId: id,
      ...sliceFromBundle(bundle),
    }));
    return id;
  },

  switchMove: (id) =>
    set((s) => {
      if (id === s.currentMoveId) return {};
      const target = s.library[id];
      if (!target) return {};
      const now = Date.now();
      const opened = { ...target, lastOpenedAt: now };
      return {
        library: { ...parkCurrentMove(s, now), [id]: opened },
        currentMoveId: id,
        ...sliceFromBundle(opened),
      };
    }),

  archiveMove: (id) => set((s) => setArchived(s, id, true)),
  unarchiveMove: (id) => set((s) => setArchived(s, id, false)),

  removeMoveLocal: (id) =>
    set((s) => {
      const library = { ...s.library };
      delete library[id];
      if (s.currentMoveId !== id) return { library };
      return { library, currentMoveId: null, ...emptyLiveSlice(Date.now()) };
    }),

  addSharedMoveFromSnapshot: (serverMoveId, snap) => {
    const id = uid('mv');
    const now = Date.now();
    set((s) => {
      const bundle = bundleFromSnapshot(id, serverMoveId, snap, now);
      return {
        library: { ...parkCurrentMove(s, now), [id]: bundle },
        currentMoveId: id,
        ...sliceFromBundle(bundle),
      };
    });
    return id;
  },

  importSharedMove: (serverMoveId, snap) =>
    set((s) => {
      // Already in the library (by server id) — don't duplicate.
      if (Object.values(s.library).some((b) => b.serverMoveId === serverMoveId)) return {};
      const id = uid('mv');
      return { library: { ...s.library, [id]: bundleFromSnapshot(id, serverMoveId, snap, Date.now()) } };
    }),
});

function setArchived(s: Store, id: string, archived: boolean): Partial<Store> {
  const bundle = s.library[id];
  return bundle ? { library: { ...s.library, [id]: { ...bundle, archived } } } : {};
}
