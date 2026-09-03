// ============================================================
// Organizard store — single source of truth for the active move.
// Zustand + AsyncStorage. Local moves work fully offline; when the active
// move is `shared`, every mutating action also enqueues a Mutation to the
// outbox, which the sync engine (store/sync.ts) flushes to the backend.
// ============================================================
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { STARTER_MARKERS, STARTER_STATUSES } from '@/data/defaults';
import type { Box, IndexedItem, Item, Marker, Member, Move, Role, Room, Status } from '@/data/types';
import { api, type ServerChanges, type ServerSnapshot } from '@/lib/api';
import { clearSession } from '@/lib/session';
import { uid } from '@/lib/uid';
import type { Mutation } from '@/shared';
import {
  newBundle,
  sliceFromBundle,
  snapshotInto,
  summarize,
  roleFor,
  type MoveBundle,
  type MoveMode,
  type MoveSummary,
  type SliceData,
} from './library';
import {
  toClientBox,
  toClientItem,
  toClientMarker,
  toClientMember,
  toClientRoom,
  toClientStatus,
} from './mappers';

export type { MoveMode } from './library';
type Account = { id: string; name: string; email: string | null };

type State = {
  onboarded: boolean;
  /** Local Pro entitlement: a 7-day trial expiry (ms). Real billing sets this later. */
  proTrialUntil: number | null;

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

  /** All moves you have, keyed by local id. */
  library: Record<string, MoveBundle>;
  /**
   * Which move is mirrored into the live slice above (null = none open).
   * INVARIANT: for the CURRENT move the live slice is authoritative —
   * `library[currentMoveId]` is a stale copy refreshed only when you leave
   * (createMove/switchMove/addSharedMoveFromSnapshot) or via `moveSummaries`'
   * on-the-fly re-snapshot. Read the live slice for the open move, never the bundle.
   */
  currentMoveId: string | null;
};

type Actions = {
  setOnboarded: (v: boolean) => void;
  /** Start the Pro free trial (gate-UI-now; real RevenueCat billing wires in later). */
  startProTrial: () => void;

  addRoom: (input: { name: string; dest?: string | null; icon?: string; color?: string }) => string;
  updateRoom: (id: string, patch: Partial<Pick<Room, 'name' | 'dest' | 'icon' | 'color'>>) => void;
  deleteRoom: (id: string) => void;
  addBox: (input: { name: string; color: string; roomId: string; status?: string }) => string;
  updateBox: (id: string, patch: Partial<Pick<Box, 'name' | 'color' | 'roomId'>>) => void;
  deleteBox: (boxId: string) => void;
  setBoxStatus: (boxId: string, statusId: string) => void;
  setBoxCover: (boxId: string, uri: string | null) => void;
  toggleBoxMarker: (boxId: string, markerId: string) => void;
  addStatus: (input: { label: string; color: string }) => string;
  addMarker: (input: { label: string; color: string; icon?: string }) => string;
  addItem: (
    boxId: string,
    input: {
      name: string;
      qty?: number;
      value?: number;
      note?: string;
      photos?: string[];
      markers?: string[];
      icon?: string;
    },
  ) => string;
  updateItem: (boxId: string, itemId: string, patch: Partial<Item>) => void;
  deleteItem: (boxId: string, itemId: string) => void;
  moveItem: (fromBoxId: string, toBoxId: string, itemId: string) => void;
  updateMove: (patch: { name?: string; from?: string; to?: string; target?: string }) => void;
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
  /** Replace a local photo URI with its uploaded server id (local-only, no mutation). */
  swapItemPhoto: (boxId: string, itemId: string, fromUri: string, toId: string) => void;

  // --- library actions ---
  createMove: (input: { name: string; from?: string; to?: string; target?: string }) => string;
  switchMove: (id: string) => void;
  archiveMove: (id: string) => void;
  unarchiveMove: (id: string) => void;
  removeMoveLocal: (id: string) => void;
  /** Delete a move: tear down the server copy if you own a shared move, then drop it locally. */
  deleteMove: (id: string) => Promise<void>;
  addSharedMoveFromSnapshot: (serverMoveId: string, snap: ServerSnapshot) => string;
  /** Add a shared move to the library from a snapshot WITHOUT switching to it (used when
   * pulling your moves after sign-in). No-op if a bundle for serverMoveId already exists. */
  importSharedMove: (serverMoveId: string, snap: ServerSnapshot) => void;
};

/** Mutation types this build understands — used to drop legacy/poison outbox entries. */
const KNOWN_MUTATION_TYPES = new Set<string>([
  'addRoom',
  'updateRoom',
  'deleteRoom',
  'addBox',
  'updateBox',
  'deleteBox',
  'setBoxStatus',
  'setBoxCover',
  'setBoxMarker',
  'addStatus',
  'addMarker',
  'addItem',
  'updateItem',
  'deleteItem',
  'moveItem',
  'updateMove',
]);

export type Store = State & Actions;

const EMPTY_MOVE: Move = { name: '', from: '', to: '', target: '' };

const initialState: State = {
  onboarded: false,
  proTrialUntil: null,
  move: EMPTY_MOVE,
  rooms: [],
  boxes: [],
  statuses: [...STARTER_STATUSES],
  markers: [...STARTER_MARKERS],
  members: [],
  itemsByBox: {},

  account: null,
  session: null,
  activeMode: 'local',
  serverMoveId: null,
  outbox: [],
  lastSyncTs: 0,

  library: {},
  currentMoveId: null,
};

const isLocalUri = (p: string): boolean =>
  p.startsWith('file://') || p.startsWith('content://') || p.startsWith('/');

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
      startProTrial: () => set({ proTrialUntil: Date.now() + 7 * 24 * 60 * 60 * 1000 }),

      addRoom: ({ name, dest = null, icon = 'box', color = 'slate' }) => {
        const id = uid('r');
        set((s) => ({ rooms: [...s.rooms, { id, name, dest, icon, color }] }));
        const m: Mutation = {
          type: 'addRoom',
          clientId: uid('c'),
          ts: Date.now(),
          payload: { id, name, dest, icon, color },
        };
        get().enqueue(m);
        return id;
      },

      updateRoom: (id, patch) => {
        set((s) => ({ rooms: s.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
        get().enqueue({ type: 'updateRoom', clientId: uid('c'), ts: Date.now(), payload: { id, ...patch } });
      },

      deleteRoom: (id) => {
        const boxIds = get()
          .boxes.filter((b) => b.roomId === id)
          .map((b) => b.id);
        set((s) => {
          const itemsByBox = { ...s.itemsByBox };
          for (const bId of boxIds) delete itemsByBox[bId];
          return {
            rooms: s.rooms.filter((r) => r.id !== id),
            boxes: s.boxes.filter((b) => b.roomId !== id),
            itemsByBox,
          };
        });
        for (const bId of boxIds)
          get().enqueue({ type: 'deleteBox', clientId: uid('c'), ts: Date.now(), payload: { id: bId } });
        get().enqueue({ type: 'deleteRoom', clientId: uid('c'), ts: Date.now(), payload: { id } });
      },

      addBox: ({ name, color, roomId, status = 'packing' }) => {
        const id = uid('b');
        const number = get().boxes.reduce((max, b) => Math.max(max, b.number), 0) + 1;
        set((s) => ({
          boxes: [...s.boxes, { id, number, name, color, roomId, status, markers: [], cover: null }],
          itemsByBox: { ...s.itemsByBox, [id]: [] },
        }));
        const m: Mutation = {
          type: 'addBox',
          clientId: uid('c'),
          ts: Date.now(),
          payload: { id, roomId, number, name, color, statusId: status },
        };
        get().enqueue(m);
        return id;
      },

      updateBox: (id, patch) => {
        set((s) => ({ boxes: s.boxes.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
        get().enqueue({ type: 'updateBox', clientId: uid('c'), ts: Date.now(), payload: { id, ...patch } });
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
        get().enqueue({
          type: 'setBoxStatus',
          clientId: uid('c'),
          ts: Date.now(),
          payload: { id: boxId, statusId },
        });
      },

      setBoxCover: (boxId, uri) => {
        set((s) => ({ boxes: s.boxes.map((b) => (b.id === boxId ? { ...b, cover: uri } : b)) }));
        // A local URI gets uploaded by the sync engine, which re-calls this with the
        // server photo id; only sync a non-local value (a real id, or an explicit clear).
        if (!uri || !isLocalUri(uri)) {
          get().enqueue({
            type: 'setBoxCover',
            clientId: uid('c'),
            ts: Date.now(),
            payload: { id: boxId, coverPhotoId: uri },
          });
        }
      },

      toggleBoxMarker: (boxId, markerId) => {
        const box = get().boxes.find((b) => b.id === boxId);
        const on = box ? !box.markers.includes(markerId) : true; // desired state after the toggle
        set((s) => ({
          boxes: s.boxes.map((b) => {
            if (b.id !== boxId) return b;
            const has = b.markers.includes(markerId);
            return {
              ...b,
              markers: has ? b.markers.filter((m) => m !== markerId) : [...b.markers, markerId],
            };
          }),
        }));
        get().enqueue({
          type: 'setBoxMarker',
          clientId: uid('c'),
          ts: Date.now(),
          payload: { boxId, markerId, on },
        });
      },

      addStatus: ({ label, color }) => {
        const id = uid('st');
        set((s) => ({ statuses: [...s.statuses, { id, label, color, custom: true }] }));
        get().enqueue({
          type: 'addStatus',
          clientId: uid('c'),
          ts: Date.now(),
          payload: { id, label, color },
        });
        return id;
      },

      addMarker: ({ label, color, icon = 'tag' }) => {
        const id = uid('mk');
        set((s) => ({ markers: [...s.markers, { id, label, color, icon, custom: true }] }));
        get().enqueue({
          type: 'addMarker',
          clientId: uid('c'),
          ts: Date.now(),
          payload: { id, label, color, icon },
        });
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
          payload: {
            id,
            boxId,
            name: item.name,
            qty: item.qty,
            valueCents: Math.round(item.value * 100),
            note: input.note ?? null,
            icon: input.icon ?? null,
            markerIds: item.markers,
            photoIds: [],
          },
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
        get().enqueue({
          type: 'deleteItem',
          clientId: uid('c'),
          ts: Date.now(),
          payload: { id: itemId, boxId },
        });
      },

      moveItem: (fromBoxId, toBoxId, itemId) => {
        set((s) => {
          const item = (s.itemsByBox[fromBoxId] ?? []).find((it) => it.id === itemId);
          if (!item) return {};
          return {
            itemsByBox: {
              ...s.itemsByBox,
              [fromBoxId]: (s.itemsByBox[fromBoxId] ?? []).filter((it) => it.id !== itemId),
              [toBoxId]: [...(s.itemsByBox[toBoxId] ?? []), { ...item, boxId: toBoxId }],
            },
          };
        });
        get().enqueue({
          type: 'moveItem',
          clientId: uid('c'),
          ts: Date.now(),
          payload: { id: itemId, fromBoxId, toBoxId },
        });
      },

      updateMove: (patch) => {
        set((s) => ({ move: { ...s.move, ...patch } }));
        get().enqueue({ type: 'updateMove', clientId: uid('c'), ts: Date.now(), payload: { ...patch } });
      },

      reset: () => set({ ...initialState }),

      // --- sync actions ---
      setSession: (session, account) => set({ session, account }),
      signOut: () => {
        void clearSession();
        set((s) => {
          const now = Date.now();
          // Reflect the open move's live state into its bundle before we filter.
          const library = { ...s.library };
          if (s.currentMoveId && library[s.currentMoveId]) {
            library[s.currentMoveId] = snapshotInto(library[s.currentMoveId], extractSlice(s), now);
          }
          // Spotify model: account (synced) moves live in the cloud — drop them from this
          // device on sign-out (re-pulled on next sign-in); keep guest/local-only moves.
          const kept: Record<string, MoveBundle> = {};
          for (const [id, b] of Object.entries(library)) {
            if (!b.serverMoveId) kept[id] = b;
          }
          // Signing out returns to the unauthenticated guest state: drop the (account-
          // tied) Pro trial back to free and reset onboarding so the welcome screen shows
          // again. Local-only moves are kept (see `kept`).
          const base = { session: null, account: null, library: kept, proTrialUntil: null, onboarded: false };
          if (s.currentMoveId && kept[s.currentMoveId]) return base; // open move survived (local)
          // Open move was a synced one we dropped (or none) — reset the live slice.
          return { ...base, currentMoveId: null, ...sliceFromBundle(newBundle('__none__', EMPTY_MOVE, now)) };
        });
      },
      enqueue: (m) => set((s) => (s.activeMode === 'shared' ? { outbox: [...s.outbox, m] } : {})),
      clearOutbox: (clientIds) =>
        set((s) => ({ outbox: s.outbox.filter((m) => !clientIds.includes(m.clientId)) })),

      applySnapshot: (snap) => {
        const itemsByBox = snapItemsByBox(snap);
        set({
          move: {
            name: snap.move.name,
            from: snap.move.from ?? '',
            to: snap.move.to ?? '',
            target: snap.move.targetDate ?? '',
          },
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
          // A row with a pending outbox mutation is locally authoritative (the LWW
          // exception). Track these per-collection so an item edit doesn't suppress an
          // unrelated update to its box row, and vice-versa.
          const dRoom = new Set<string>();
          const dStatus = new Set<string>();
          const dMarker = new Set<string>();
          const dBox = new Set<string>();
          const dItem = new Set<string>();
          for (const mm of s.outbox) {
            const p = mm.payload as Record<string, string>;
            switch (mm.type) {
              case 'addRoom':
              case 'updateRoom':
              case 'deleteRoom':
                dRoom.add(p.id);
                break;
              case 'addStatus':
                dStatus.add(p.id);
                break;
              case 'addMarker':
                dMarker.add(p.id);
                break;
              case 'addBox':
              case 'updateBox':
              case 'deleteBox':
              case 'setBoxStatus':
              case 'setBoxCover':
                dBox.add(p.id);
                break;
              case 'setBoxMarker':
                dBox.add(p.boxId);
                break;
              case 'addItem':
              case 'updateItem':
              case 'deleteItem':
              case 'moveItem':
                dItem.add(p.id);
                break;
            }
          }

          // Skipping a dirty row must NOT advance the cursor past it, or a concurrent
          // server change to that row would be lost — hold the cursor back so it re-arrives.
          let minSkipped = Infinity;
          const fresh = <T extends { id: string; updatedAt: number }>(rows: T[], dirty: Set<string>) =>
            rows.filter((r) => {
              if (dirty.has(r.id)) {
                minSkipped = Math.min(minSkipped, r.updatedAt);
                return false;
              }
              return true;
            });

          const itemsByBox = { ...s.itemsByBox };
          const boxes = mergeList(s.boxes, fresh(ch.boxes, dBox), toClientBox);
          for (const b of boxes) if (!itemsByBox[b.id]) itemsByBox[b.id] = [];
          for (const it of ch.items) {
            if (dItem.has(it.id)) {
              minSkipped = Math.min(minSkipped, it.updatedAt);
              continue;
            }
            // Preserve local (not-yet-uploaded) photo URIs so a pull can't drop a fresh capture.
            const existing = (itemsByBox[it.boxId] ?? []).find((x) => x.id === it.id);
            const localPhotos = (existing?.photos ?? []).filter(isLocalUri);
            const arr = (itemsByBox[it.boxId] ?? []).filter((x) => x.id !== it.id);
            if (!it.deletedAt) {
              const ci = toClientItem(it);
              const base = ci.photos ?? [];
              ci.photos = [...base, ...localPhotos.filter((p) => !base.includes(p))];
              arr.push(ci);
            }
            itemsByBox[it.boxId] = arr;
          }

          // Run every fresh() (which records minSkipped) BEFORE computing the cursor,
          // so a skipped room/status/marker also holds the cursor back.
          const rooms = mergeList(s.rooms, fresh(ch.rooms, dRoom), toClientRoom);
          const statuses = mergeList(s.statuses, fresh(ch.statuses, dStatus), toClientStatus);
          const markers = mergeList(s.markers, fresh(ch.markers, dMarker), toClientMarker);
          const cursor = minSkipped === Infinity ? ch.cursor : Math.min(ch.cursor, minSkipped - 1);
          return {
            rooms,
            statuses,
            markers,
            boxes,
            itemsByBox,
            members: ch.members.map(toClientMember),
            lastSyncTs: cursor,
          };
        });
      },

      markActiveShared: (serverMoveId, snap) => {
        set({ activeMode: 'shared', serverMoveId, lastSyncTs: 0, outbox: [] });
        get().applySnapshot(snap);
      },

      goShared: (serverMoveId) => set({ activeMode: 'shared', serverMoveId, lastSyncTs: 0, outbox: [] }),

      swapItemPhoto: (boxId, itemId, fromUri, toId) =>
        set((s) => ({
          itemsByBox: {
            ...s.itemsByBox,
            [boxId]: (s.itemsByBox[boxId] ?? []).map((it) =>
              it.id === itemId
                ? { ...it, photos: (it.photos ?? []).map((p) => (p === fromUri ? toId : p)) }
                : it,
            ),
          },
        })),

      // --- library actions ---
      createMove: ({ name, from = '', to = '', target = '' }) => {
        const id = uid('mv');
        const now = Date.now();
        const bundle = newBundle(id, { name, from, to, target }, now);
        set((s) => {
          const library = { ...s.library };
          if (s.currentMoveId && library[s.currentMoveId]) {
            library[s.currentMoveId] = snapshotInto(library[s.currentMoveId], extractSlice(s), now);
          }
          library[id] = bundle;
          return { library, currentMoveId: id, ...sliceFromBundle(bundle) };
        });
        return id;
      },

      switchMove: (id) =>
        set((s) => {
          if (id === s.currentMoveId) return {};
          const target = s.library[id];
          if (!target) return {};
          const now = Date.now();
          const library = { ...s.library };
          if (s.currentMoveId && library[s.currentMoveId]) {
            library[s.currentMoveId] = snapshotInto(library[s.currentMoveId], extractSlice(s), now);
          }
          const opened = { ...target, lastOpenedAt: now };
          library[id] = opened;
          return { library, currentMoveId: id, ...sliceFromBundle(opened) };
        }),

      archiveMove: (id) =>
        set((s) =>
          s.library[id] ? { library: { ...s.library, [id]: { ...s.library[id], archived: true } } } : {},
        ),
      unarchiveMove: (id) =>
        set((s) =>
          s.library[id] ? { library: { ...s.library, [id]: { ...s.library[id], archived: false } } } : {},
        ),

      removeMoveLocal: (id) =>
        set((s) => {
          const library = { ...s.library };
          delete library[id];
          if (s.currentMoveId !== id) return { library };
          return {
            library,
            currentMoveId: null,
            ...sliceFromBundle(newBundle('__none__', EMPTY_MOVE, Date.now())),
          };
        }),

      deleteMove: async (id) => {
        const s = get();
        // For the open move the live slice is authoritative; for others read the bundle.
        const data = id === s.currentMoveId ? extractSlice(s) : s.library[id];
        if (!data) return;
        const isOwnedShared =
          data.activeMode === 'shared' &&
          data.serverMoveId &&
          roleFor('shared', data.members, s.account?.id ?? null) === 'owner';
        if (isOwnedShared && s.session && data.serverMoveId) {
          try {
            await api.deleteMove(s.session, data.serverMoveId);
          } catch (e) {
            console.warn('deleteMove: server teardown failed; removing locally', e);
          }
        }
        get().removeMoveLocal(id);
      },

      addSharedMoveFromSnapshot: (serverMoveId, snap) => {
        const id = uid('mv');
        const now = Date.now();
        set((s) => {
          const library = { ...s.library };
          if (s.currentMoveId && library[s.currentMoveId]) {
            library[s.currentMoveId] = snapshotInto(library[s.currentMoveId], extractSlice(s), now);
          }
          const bundle: MoveBundle = {
            ...newBundle(
              id,
              {
                name: snap.move.name,
                from: snap.move.from ?? '',
                to: snap.move.to ?? '',
                target: snap.move.targetDate ?? '',
              },
              now,
            ),
            activeMode: 'shared',
            serverMoveId,
            statuses: snap.statuses.map(toClientStatus),
            markers: snap.markers.map(toClientMarker),
            members: snap.members.map(toClientMember),
            rooms: snap.rooms.map(toClientRoom),
            boxes: snap.boxes.map(toClientBox),
            itemsByBox: snapItemsByBox(snap),
            lastSyncTs: 0,
            outbox: [],
          };
          library[id] = bundle;
          return { library, currentMoveId: id, ...sliceFromBundle(bundle) };
        });
        return id;
      },

      importSharedMove: (serverMoveId, snap) => {
        set((s) => {
          // Already in the library (by server id) — don't duplicate.
          if (Object.values(s.library).some((b) => b.serverMoveId === serverMoveId)) return {};
          const id = uid('mv');
          const now = Date.now();
          const bundle: MoveBundle = {
            ...newBundle(
              id,
              {
                name: snap.move.name,
                from: snap.move.from ?? '',
                to: snap.move.to ?? '',
                target: snap.move.targetDate ?? '',
              },
              now,
            ),
            activeMode: 'shared',
            serverMoveId,
            statuses: snap.statuses.map(toClientStatus),
            markers: snap.markers.map(toClientMarker),
            members: snap.members.map(toClientMember),
            rooms: snap.rooms.map(toClientRoom),
            boxes: snap.boxes.map(toClientBox),
            itemsByBox: snapItemsByBox(snap),
            lastSyncTs: 0,
            outbox: [],
          };
          return { library: { ...s.library, [id]: bundle } };
        });
      },
    }),
    {
      name: 'organizard-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      // v2→v3 migrates the single flat active-move into the new library shape.
      // Drop any persisted outbox entries this build no longer understands (e.g. a
      // legacy `toggleBoxMarker`), so a poison mutation can't wedge sync forever.
      migrate: (persisted, version) => {
        const st = persisted as (Partial<State> & Record<string, unknown>) | undefined;
        if (!st) return st as unknown as Store;

        if (version < 3) {
          const known = (m: Mutation) => KNOWN_MUTATION_TYPES.has(m.type);
          const outbox = Array.isArray(st.outbox) ? (st.outbox as Mutation[]).filter(known) : [];
          const isRealShared = st.activeMode === 'shared' && Boolean(st.serverMoveId);
          const now = Date.now();

          if (isRealShared) {
            const id = uid('mv');
            const bundle: MoveBundle = {
              id,
              archived: false,
              createdAt: now,
              lastOpenedAt: now,
              move: (st.move as Move) ?? EMPTY_MOVE,
              rooms: (st.rooms as Room[]) ?? [],
              boxes: (st.boxes as Box[]) ?? [],
              statuses: (st.statuses as Status[]) ?? [...STARTER_STATUSES],
              markers: (st.markers as Marker[]) ?? [...STARTER_MARKERS],
              members: (st.members as Member[]) ?? [],
              itemsByBox: (st.itemsByBox as Record<string, Item[]>) ?? {},
              activeMode: 'shared',
              serverMoveId: st.serverMoveId as string,
              outbox,
              lastSyncTs: (st.lastSyncTs as number) ?? 0,
            };
            return {
              ...st,
              role: undefined,
              library: { [id]: bundle },
              currentMoveId: id,
            } as unknown as Store;
          }

          return {
            ...st,
            role: undefined,
            onboarded: false,
            library: {},
            currentMoveId: null,
            move: { name: '', from: '', to: '', target: '' },
            rooms: [],
            boxes: [],
            statuses: [...STARTER_STATUSES],
            markers: [...STARTER_MARKERS],
            members: [],
            itemsByBox: {},
            activeMode: 'local',
            serverMoveId: null,
            outbox: [],
            lastSyncTs: 0,
          } as unknown as Store;
        }
        return st as Store;
      },
      partialize: (s) => ({
        onboarded: s.onboarded,
        proTrialUntil: s.proTrialUntil,
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
        library: s.library,
        currentMoveId: s.currentMoveId,
      }),
    },
  ),
);

// ============================================================
// Library helpers
// ============================================================

/** Pull the live-slice fields off the full store state. */
function extractSlice(s: State): SliceData {
  return {
    move: s.move,
    rooms: s.rooms,
    boxes: s.boxes,
    statuses: s.statuses,
    markers: s.markers,
    members: s.members,
    itemsByBox: s.itemsByBox,
    activeMode: s.activeMode,
    serverMoveId: s.serverMoveId,
    outbox: s.outbox,
    lastSyncTs: s.lastSyncTs,
  };
}

function snapItemsByBox(snap: ServerSnapshot): Record<string, Item[]> {
  const out: Record<string, Item[]> = {};
  for (const b of snap.boxes) out[b.id] = [];
  for (const it of snap.items) (out[it.boxId] ??= []).push(toClientItem(it));
  return out;
}

// ============================================================
// Hydration + selectors
// ============================================================

/** True once the persisted state has been read back from AsyncStorage. */
export function useHasHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useStore.persist.onFinishHydration(onChange),
    () => useStore.persist.hasHydrated(),
    () => false,
  );
}

// Stable empty reference so the selector keeps a stable identity (Zustand v5 / useSyncExternalStore).
const EMPTY_ITEMS: Item[] = [];
export const selectBoxItems = (s: Store, boxId: string): Item[] => s.itemsByBox[boxId] ?? EMPTY_ITEMS;

export const boxStats = (s: Store, boxId: string): { count: number; value: number } => {
  const items = s.itemsByBox[boxId] ?? [];
  return {
    count: items.reduce((n, it) => n + (it.qty || 1), 0),
    // `value` is the per-unit price, so a line's worth is price × quantity.
    value: items.reduce((n, it) => n + (it.value || 0) * (it.qty || 1), 0),
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

/** Resolve an item by id across all boxes, returning it with its owning box. */
export const findItem = (s: Store, itemId: string): { item: Item; box: Box } | undefined => {
  for (const [boxId, items] of Object.entries(s.itemsByBox)) {
    const item = items.find((it) => it.id === itemId);
    if (item) {
      const box = s.boxes.find((b) => b.id === boxId);
      if (box) return { item, box };
    }
  }
  return undefined;
};

/** One photo in a box's combined gallery — the cover, then each item's photos in order. */
export type BoxPhoto = { ref: string; kind: 'box' | 'item'; itemId?: string; itemName?: string };

/**
 * Assemble a box's photo list: the cover first, then every item's photos in item order.
 * Builds a FRESH array each call — callers must memoize (useMemo over stable slices),
 * never feed this straight to useShallow or it loops.
 */
export const boxPhotos = (s: Store, boxId: string): BoxPhoto[] => {
  const out: BoxPhoto[] = [];
  const box = s.boxes.find((b) => b.id === boxId);
  if (box?.cover) out.push({ ref: box.cover, kind: 'box' });
  for (const it of s.itemsByBox[boxId] ?? []) {
    for (const ph of it.photos ?? []) out.push({ ref: ph, kind: 'item', itemId: it.id, itemName: it.name });
  }
  return out;
};

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

/**
 * Pro entitlement = signed in AND an active trial (real billing will also set this
 * later). Pro is account-tied: a signed-out guest is always free, so the paywall gates
 * for guests and a stale trial flag can't unlock a guest. (Sign-out also clears the
 * trial — see `signOut`.)
 */
export const isProNow = (s: { proTrialUntil: number | null; session: string | null }): boolean =>
  s.session != null && s.proTrialUntil != null && s.proTrialUntil > Date.now();

export const moveSummaries = (s: Store): MoveSummary[] => {
  const out: MoveSummary[] = [];
  const accountId = s.account?.id ?? null;
  for (const b of Object.values(s.library)) {
    out.push(
      b.id === s.currentMoveId
        ? summarize(snapshotInto(b, extractSlice(s), b.lastOpenedAt), accountId)
        : summarize(b, accountId),
    );
  }
  return out.sort((a, z) => z.lastOpenedAt - a.lastOpenedAt);
};

export const currentRole = (s: Store): Role => roleFor(s.activeMode, s.members, s.account?.id ?? null);
