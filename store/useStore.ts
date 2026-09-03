// The app's store instance: the slices in store/slices/* persisted to AsyncStorage.
// Screens import `useStore` plus selectors from here; the store's shape is in
// store/types.ts and its assembly in store/createStore.ts (which tests use directly).
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createAppStore } from './createStore';

export const useStore = createAppStore(AsyncStorage);

/** True once the persisted state has been read back from AsyncStorage. */
export function useHasHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useStore.persist.onFinishHydration(onChange),
    () => useStore.persist.hasHydrated(),
    () => false,
  );
}

export * from './selectors';
export type { MoveMode } from './library';
export type { Account, State, Store } from './types';
