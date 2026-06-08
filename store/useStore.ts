// ============================================================
// Organizard store — the single source of truth for the move.
// Zustand + AsyncStorage persistence. Seeds from the mock NYC Move.
// ============================================================
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  boxes as seedBoxes,
  itemsByBox as seedItems,
  markers as seedMarkers,
  members as seedMembers,
  move as seedMove,
  rooms as seedRooms,
  statuses as seedStatuses,
} from '@/data/mockData';
import type { Box, IndexedItem, Item, Marker, Member, Move, Role, Room, Status } from '@/data/types';
import { uid } from '@/lib/uid';

type State = {
  /** Has the user finished onboarding? */
  onboarded: boolean;
  /** The role the user is currently "viewing as" (demo switcher). */
  role: Role;

  move: Move;
  rooms: Room[];
  boxes: Box[];
  statuses: Status[];
  markers: Marker[];
  members: Member[];
  itemsByBox: Record<string, Item[]>;
};

type Actions = {
  setOnboarded: (v: boolean) => void;
  setRole: (role: Role) => void;

  addRoom: (input: { name: string; dest?: string | null; icon?: string }) => string;

  addBox: (input: { name: string; color: string; roomId: string; status?: string }) => string;
  deleteBox: (boxId: string) => void;
  setBoxStatus: (boxId: string, statusId: string) => void;
  setBoxCover: (boxId: string, uri: string | null) => void;
  toggleBoxMarker: (boxId: string, markerId: string) => void;

  addStatus: (input: { label: string; color: string }) => string;
  addMarker: (input: { label: string; color: string; icon?: string }) => string;

  addItem: (
    boxId: string,
    input: { name: string; qty?: number; value?: number; note?: string; photos?: string[]; markers?: string[]; icon?: string },
  ) => string;
  updateItem: (boxId: string, itemId: string, patch: Partial<Item>) => void;
  deleteItem: (boxId: string, itemId: string) => void;

  /** Re-seed everything back to the demo move. */
  reset: () => void;
};

export type Store = State & Actions;

const initialState: State = {
  onboarded: false,
  role: 'owner',
  move: seedMove,
  rooms: seedRooms,
  boxes: seedBoxes,
  statuses: seedStatuses,
  markers: seedMarkers,
  members: seedMembers,
  itemsByBox: seedItems,
};

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initialState,

      setOnboarded: (v) => set({ onboarded: v }),
      setRole: (role) => set({ role }),

      addRoom: ({ name, dest = null, icon = 'box' }) => {
        const id = uid('r');
        set((s) => ({ rooms: [...s.rooms, { id, name, dest, icon }] }));
        return id;
      },

      addBox: ({ name, color, roomId, status = 'packing' }) => {
        const id = uid('b');
        const number = get().boxes.reduce((max, b) => Math.max(max, b.number), 0) + 1;
        const box: Box = { id, number, name, color, roomId, status, markers: [], cover: null };
        set((s) => ({ boxes: [...s.boxes, box], itemsByBox: { ...s.itemsByBox, [id]: [] } }));
        return id;
      },

      deleteBox: (boxId) =>
        set((s) => {
          const rest = { ...s.itemsByBox };
          delete rest[boxId];
          return { boxes: s.boxes.filter((b) => b.id !== boxId), itemsByBox: rest };
        }),

      setBoxStatus: (boxId, statusId) =>
        set((s) => ({ boxes: s.boxes.map((b) => (b.id === boxId ? { ...b, status: statusId } : b)) })),

      setBoxCover: (boxId, uri) =>
        set((s) => ({ boxes: s.boxes.map((b) => (b.id === boxId ? { ...b, cover: uri } : b)) })),

      toggleBoxMarker: (boxId, markerId) =>
        set((s) => ({
          boxes: s.boxes.map((b) => {
            if (b.id !== boxId) return b;
            const has = b.markers.includes(markerId);
            return { ...b, markers: has ? b.markers.filter((m) => m !== markerId) : [...b.markers, markerId] };
          }),
        })),

      addStatus: ({ label, color }) => {
        const id = uid('st');
        set((s) => ({ statuses: [...s.statuses, { id, label, color, custom: true }] }));
        return id;
      },

      addMarker: ({ label, color, icon = 'tag' }) => {
        const id = uid('mk');
        set((s) => ({ markers: [...s.markers, { id, label, color, icon, custom: true }] }));
        return id;
      },

      addItem: (boxId, input) => {
        const id = uid('i');
        const item: Item = {
          id,
          boxId,
          name: input.name,
          qty: input.qty ?? 1,
          value: input.value ?? 0,
          note: input.note,
          photos: input.photos ?? [],
          markers: input.markers ?? [],
          icon: input.icon,
        };
        set((s) => ({ itemsByBox: { ...s.itemsByBox, [boxId]: [...(s.itemsByBox[boxId] ?? []), item] } }));
        return id;
      },

      updateItem: (boxId, itemId, patch) =>
        set((s) => ({
          itemsByBox: {
            ...s.itemsByBox,
            [boxId]: (s.itemsByBox[boxId] ?? []).map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
          },
        })),

      deleteItem: (boxId, itemId) =>
        set((s) => ({
          itemsByBox: {
            ...s.itemsByBox,
            [boxId]: (s.itemsByBox[boxId] ?? []).filter((it) => it.id !== itemId),
          },
        })),

      reset: () => set({ ...initialState }),
    }),
    {
      name: 'organizard-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist data + onboarding + role. (role persists so the demo sticks.)
      partialize: (s) => ({
        onboarded: s.onboarded,
        role: s.role,
        move: s.move,
        rooms: s.rooms,
        boxes: s.boxes,
        statuses: s.statuses,
        markers: s.markers,
        members: s.members,
        itemsByBox: s.itemsByBox,
      }),
    },
  ),
);

// ============================================================
// Selectors / derived helpers (pure — call inside components).
// ============================================================

/** True once AsyncStorage rehydration has finished — gate first navigation on this. */
export function useHasHydrated(): boolean {
  const [hydrated, setHydrated] = useState<boolean>(() => useStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useStore.persist.hasHydrated());
    return unsub;
  }, []);
  return hydrated;
}

/** Items in a box. */
export const selectBoxItems = (s: Store, boxId: string): Item[] => s.itemsByBox[boxId] ?? [];

/** Live item count + total value for a box (computed from its items). */
export const boxStats = (s: Store, boxId: string): { count: number; value: number } => {
  const items = s.itemsByBox[boxId] ?? [];
  return {
    count: items.reduce((n, it) => n + (it.qty || 1), 0),
    value: items.reduce((n, it) => n + (it.value || 0), 0),
  };
};

/** Move progress — boxes sealed of total. */
export const moveProgress = (s: Store): { sealed: number; total: number } => ({
  sealed: s.boxes.filter((b) => b.status === 'sealed').length,
  total: s.boxes.length,
});

/** Move totals — boxes / items / value. */
export const moveTotals = (s: Store): { boxes: number; items: number; value: number } => {
  let items = 0;
  let value = 0;
  for (const b of s.boxes) {
    const st = boxStats(s, b.id);
    items += st.count;
    value += st.value;
  }
  return { boxes: s.boxes.length, items, value };
};

export const statusById = (s: Store, id: string): Status | undefined => s.statuses.find((x) => x.id === id);
export const markerById = (s: Store, id: string): Marker | undefined => s.markers.find((x) => x.id === id);
export const roomById = (s: Store, id: string): Room | undefined => s.rooms.find((x) => x.id === id);
export const boxById = (s: Store, id: string): Box | undefined => s.boxes.find((x) => x.id === id);

/** Flattened, searchable item index with Room › Box breadcrumb — powers Find. */
export const allIndexedItems = (s: Store): IndexedItem[] => {
  const out: IndexedItem[] = [];
  for (const b of s.boxes) {
    const room = s.rooms.find((r) => r.id === b.roomId);
    for (const it of s.itemsByBox[b.id] ?? []) {
      out.push({
        ...it,
        boxName: b.name,
        boxNumber: b.number,
        boxColor: b.color,
        roomId: b.roomId,
        roomName: room?.name ?? '',
      });
    }
  }
  return out;
};
