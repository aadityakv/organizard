// ============================================================
// Organizard store — single source of truth for the active move.
// Zustand + AsyncStorage. Local moves work fully offline; when the active
// move is `shared`, every mutating action also enqueues a Mutation to the
// outbox, which the sync engine (store/sync.ts) flushes to the backend.
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
import type { ServerChanges, ServerSnapshot } from '@/lib/api';
import { clearSession } from '@/lib/session';
import { uid } from '@/lib/uid';
import type { Mutation } from '@/shared';
import { toClientBox, toClientItem, toClientMarker, toClientMember, toClientRoom, toClientStatus } from './mappers';

export type MoveMode = 'local' | 'shared';
type Account = { id: string; name: string; email: string | null };

type State = {
  onboarded: boolean;
  role: Role;

  move: Move;
  rooms: Room[];
  boxes: Box[];
  statuses: Status[];
  markers: Marker[];
  members: Member[];
  itemsByBox: Record<string, Item[]>;

  // --- sync layer (dormant for local moves) ---
  /** Signed-in account (null until the user authenticates to share). */
  account: Account | null;
  /** In-memory session token (loaded from secure-store at boot). */
  session: string | null;
  /** Mode of the active move. */
  activeMode: MoveMode;
  /** Server id of the active move when shared. */
  serverMoveId: string | null;
  /** Pending mutations awaiting flush. */
  outbox: Mutation[];
  /** Server timestamp of the last successful delta pull. */
  lastSyncTs: number;
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
  reset: () => void;

  // --- sync actions ---
  setSession: (session: string, account: Account) => void;
  signOut: () => void;
  enqueue: (m: Mutation) => void;
  clearOutbox: (clientIds: string[]) => void;
  applySnapshot: (snap: ServerSnapshot) => void;
  applyChanges: (ch: ServerChanges) => void;
  /** Flip the active move to shared and seed it from a server snapshot. */
  markActiveShared: (serverMoveId: string, snap: ServerSnapshot) => void;
  /** Flip the active (already-pushed) move to shared, keeping local data as-is. */
  goShared: (serverMoveId: string) => void;
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

  account: null,
  session: null,
  activeMode: 'local',
  serverMoveId: null,
  outbox: [],
  lastSyncTs: 0,
};

/** Upsert by id, dropping tombstoned (deletedAt) rows — used by delta merge. */
function mergeList<C extends { id: string }, S extends { id: string; deletedAt?: number | null }>(
  current: C[],
  incoming: S[],
  map: (s: S) => C,
): C[] {
  const byId = new Map(current.map((x) => [x.id, x] as const));
  for (const inc of incoming) {
    if (inc.deletedAt) byId.delete(inc.id);
    else byId.set(inc.id, map(inc));
  }
  return [...byId.values()];
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initialState,

      setOnboarded: (v) => set({ onboarded: v }),
      setRole: (role) => set({ role }),

      addRoom: ({ name, dest = null, icon = 'box' }) => {
        const id = uid('r');
        set((s) => ({ rooms: [...s.rooms, { id, name, dest, icon }] }));
        const m: Mutation = { type: 'addRoom', clientId: uid('c'), ts: Date.now(), payload: { id, name, dest, icon } };
        get().enqueue(m);
        return id;
      },

      addBox: ({ name, color, roomId, status = 'packing' }) => {
        const id = uid('b');
        const number = get().boxes.reduce((max, b) => Math.max(max, b.number), 0) + 1;
        set((s) => ({
          boxes: [...s.boxes, { id, number, name, color, roomId, status, markers: [], cover: null }],
          itemsByBox: { ...s.itemsByBox, [id]: [] },
        }));
        const m: Mutation = { type: 'addBox', clientId: uid('c'), ts: Date.now(), payload: { id, roomId, number, name, color, statusId: status } };
        get().enqueue(m);
        return id;
      },

      deleteBox: (boxId) => {
        set((s) => {
          const rest = { ...s.itemsByBox };
          delete rest[boxId];
          return { boxes: s.boxes.filter((b) => b.id !== boxId), itemsByBox: rest };
        });
        get().enqueue({ type: 'deleteBox', clientId: uid('c'), ts: Date.now(), payload: { id: boxId } });
      },

      setBoxStatus: (boxId, statusId) => {
        set((s) => ({ boxes: s.boxes.map((b) => (b.id === boxId ? { ...b, status: statusId } : b)) }));
        get().enqueue({ type: 'setBoxStatus', clientId: uid('c'), ts: Date.now(), payload: { id: boxId, statusId } });
      },

      setBoxCover: (boxId, uri) => {
        set((s) => ({ boxes: s.boxes.map((b) => (b.id === boxId ? { ...b, cover: uri } : b)) }));
        get().enqueue({ type: 'setBoxCover', clientId: uid('c'), ts: Date.now(), payload: { id: boxId, coverPhotoId: uri } });
      },

      toggleBoxMarker: (boxId, markerId) => {
        set((s) => ({
          boxes: s.boxes.map((b) => {
            if (b.id !== boxId) return b;
            const has = b.markers.includes(markerId);
            return { ...b, markers: has ? b.markers.filter((m) => m !== markerId) : [...b.markers, markerId] };
          }),
        }));
        get().enqueue({ type: 'toggleBoxMarker', clientId: uid('c'), ts: Date.now(), payload: { boxId, markerId } });
      },

      addStatus: ({ label, color }) => {
        const id = uid('st');
        set((s) => ({ statuses: [...s.statuses, { id, label, color, custom: true }] }));
        get().enqueue({ type: 'addStatus', clientId: uid('c'), ts: Date.now(), payload: { id, label, color } });
        return id;
      },

      addMarker: ({ label, color, icon = 'tag' }) => {
        const id = uid('mk');
        set((s) => ({ markers: [...s.markers, { id, label, color, icon, custom: true }] }));
        get().enqueue({ type: 'addMarker', clientId: uid('c'), ts: Date.now(), payload: { id, label, color, icon } });
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
        const m: Mutation = {
          type: 'addItem',
          clientId: uid('c'),
          ts: Date.now(),
          payload: { id, boxId, name: item.name, qty: item.qty, valueCents: Math.round(item.value * 100), note: input.note ?? null, icon: input.icon ?? null, markerIds: item.markers, photoIds: [] },
        };
        get().enqueue(m);
        return id;
      },

      updateItem: (boxId, itemId, patch) => {
        set((s) => ({
          itemsByBox: {
            ...s.itemsByBox,
            [boxId]: (s.itemsByBox[boxId] ?? []).map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
          },
        }));
        const payload: Extract<Mutation, { type: 'updateItem' }>['payload'] = { id: itemId, boxId };
        if (patch.name !== undefined) payload.name = patch.name;
        if (patch.qty !== undefined) payload.qty = patch.qty;
        if (patch.value !== undefined) payload.valueCents = Math.round(patch.value * 100);
        if (patch.note !== undefined) payload.note = patch.note ?? null;
        if (patch.markers !== undefined) payload.markerIds = patch.markers;
        get().enqueue({ type: 'updateItem', clientId: uid('c'), ts: Date.now(), payload });
      },

      deleteItem: (boxId, itemId) => {
        set((s) => ({
          itemsByBox: {
            ...s.itemsByBox,
            [boxId]: (s.itemsByBox[boxId] ?? []).filter((it) => it.id !== itemId),
          },
        }));
        get().enqueue({ type: 'deleteItem', clientId: uid('c'), ts: Date.now(), payload: { id: itemId, boxId } });
      },

      reset: () => set({ ...initialState }),

      // --- sync actions ---
      setSession: (session, account) => set({ session, account }),
      signOut: () => {
        void clearSession();
        set({ session: null, account: null });
      },
      enqueue: (m) => set((s) => (s.activeMode === 'shared' ? { outbox: [...s.outbox, m] } : {})),
      clearOutbox: (clientIds) => set((s) => ({ outbox: s.outbox.filter((m) => !clientIds.includes(m.clientId)) })),

      applySnapshot: (snap) => {
        const itemsByBox: Record<string, Item[]> = {};
        for (const b of snap.boxes) itemsByBox[b.id] = [];
        for (const it of snap.items) (itemsByBox[it.boxId] ??= []).push(toClientItem(it));
        set({
          move: { name: snap.move.name, from: snap.move.from ?? '', to: snap.move.to ?? '', target: snap.move.targetDate ?? '' },
          rooms: snap.rooms.map(toClientRoom),
          statuses: snap.statuses.map(toClientStatus),
          markers: snap.markers.map(toClientMarker),
          members: snap.members.map(toClientMember),
          boxes: snap.boxes.map(toClientBox),
          itemsByBox,
        });
      },

      applyChanges: (ch) => {
        set((s) => {
          const itemsByBox = { ...s.itemsByBox };
          const boxes = mergeList(s.boxes, ch.boxes, toClientBox);
          for (const b of boxes) if (!itemsByBox[b.id]) itemsByBox[b.id] = [];
          for (const it of ch.items) {
            const arr = (itemsByBox[it.boxId] ?? []).filter((x) => x.id !== it.id);
            if (!it.deletedAt) arr.push(toClientItem(it));
            itemsByBox[it.boxId] = arr;
          }
          return {
            rooms: mergeList(s.rooms, ch.rooms, toClientRoom),
            statuses: mergeList(s.statuses, ch.statuses, toClientStatus),
            markers: mergeList(s.markers, ch.markers, toClientMarker),
            boxes,
            itemsByBox,
            members: ch.members.map(toClientMember),
            lastSyncTs: ch.serverTime,
          };
        });
      },

      markActiveShared: (serverMoveId, snap) => {
        set({ activeMode: 'shared', serverMoveId, lastSyncTs: 0, outbox: [] });
        get().applySnapshot(snap);
      },

      goShared: (serverMoveId) => set({ activeMode: 'shared', serverMoveId, lastSyncTs: 0, outbox: [] }),
    }),
    {
      name: 'organizard-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
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
        account: s.account,
        activeMode: s.activeMode,
        serverMoveId: s.serverMoveId,
        outbox: s.outbox,
        lastSyncTs: s.lastSyncTs,
      }),
    },
  ),
);

// ============================================================
// Hydration + selectors
// ============================================================

export function useHasHydrated(): boolean {
  const [hydrated, setHydrated] = useState<boolean>(() => useStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useStore.persist.hasHydrated());
    return unsub;
  }, []);
  return hydrated;
}

export const selectBoxItems = (s: Store, boxId: string): Item[] => s.itemsByBox[boxId] ?? [];

export const boxStats = (s: Store, boxId: string): { count: number; value: number } => {
  const items = s.itemsByBox[boxId] ?? [];
  return {
    count: items.reduce((n, it) => n + (it.qty || 1), 0),
    value: items.reduce((n, it) => n + (it.value || 0), 0),
  };
};

export const moveProgress = (s: Store): { sealed: number; total: number } => ({
  sealed: s.boxes.filter((b) => b.status === 'sealed').length,
  total: s.boxes.length,
});

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
