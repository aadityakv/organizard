// Assembles the store from its slices and wires persistence. The storage backend is
// injected so the same store runs against AsyncStorage in the app and against an
// in-memory map in tests.
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { migrate, partialize, STORE_KEY, STORE_VERSION } from './persist';
import { initialState } from './shape';
import { createInventorySlice } from './slices/inventory';
import { createLibrarySlice } from './slices/library';
import { createSyncSlice } from './slices/sync';
import type { Store } from './types';

/** Build the persisted store against the given storage (AsyncStorage in the app, memory in tests). */
export function createAppStore(storage: StateStorage) {
  return create<Store>()(
    persist(
      (...a) => ({
        ...initialState,
        ...createInventorySlice(...a),
        ...createSyncSlice(...a),
        ...createLibrarySlice(...a),
      }),
      {
        name: STORE_KEY,
        storage: createJSONStorage(() => storage),
        version: STORE_VERSION,
        migrate,
        partialize,
      },
    ),
  );
}

export type AppStore = ReturnType<typeof createAppStore>;
