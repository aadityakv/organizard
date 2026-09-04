// Read-side helpers over the store state. Selectors that return a NEW array or
// object per call are marked; feed those to useMemo over stable slices (or wrap in
// useShallow when the values are stable refs), never straight to useStore, or React
// 19 loops with "Maximum update depth exceeded".
import type { Box, IndexedItem, Item, Marker, Role, Room, Status } from '@/data/types';

import { roleFor, summarize, type MoveSummary, type SliceData } from './library';
import { extractSlice } from './shape';
import type { State } from './types';

const EMPTY_ITEMS: Item[] = [];

/** Stable reference for an empty box so the selector identity does not churn. */
export const selectBoxItems = (s: State, boxId: string): Item[] => s.itemsByBox[boxId] ?? EMPTY_ITEMS;

/** Builds a fresh object: wrap in useShallow. */
export const boxStats = (s: State, boxId: string): { count: number; value: number } => {
  const items = s.itemsByBox[boxId] ?? [];
  return {
    count: items.reduce((n, it) => n + (it.qty || 1), 0),
    // `value` is the per-unit price, so a line's worth is price × quantity.
    value: items.reduce((n, it) => n + (it.value || 0) * (it.qty || 1), 0),
  };
};

/** Builds a fresh object: wrap in useShallow. */
export const moveProgress = (s: State): { sealed: number; total: number } => ({
  sealed: s.boxes.filter((b) => b.status === 'sealed').length,
  total: s.boxes.length,
});

/** Builds a fresh object: wrap in useShallow. */
export const moveTotals = (s: State): { boxes: number; items: number; value: number } => {
  let items = 0;
  let value = 0;
  for (const b of s.boxes) {
    const st = boxStats(s, b.id);
    items += st.count;
    value += st.value;
  }
  return { boxes: s.boxes.length, items, value };
};

/** Status lookup by id. */
export const statusById = (s: State, id: string): Status | undefined => s.statuses.find((x) => x.id === id);
/** Marker lookup by id. */
export const markerById = (s: State, id: string): Marker | undefined => s.markers.find((x) => x.id === id);
/** Room lookup by id. */
export const roomById = (s: State, id: string): Room | undefined => s.rooms.find((x) => x.id === id);
/** Box lookup by id. */
export const boxById = (s: State, id: string): Box | undefined => s.boxes.find((x) => x.id === id);

/** Resolve an item by id across all boxes, returning it with its owning box. Fresh object: useMemo. */
export const findItem = (s: State, itemId: string): { item: Item; box: Box } | undefined => {
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

/** A box's photo list: the cover first, then every item's photos in item order. Fresh array: useMemo. */
export const boxPhotos = (s: Pick<State, 'boxes' | 'itemsByBox'>, boxId: string): BoxPhoto[] => {
  const out: BoxPhoto[] = [];
  const box = s.boxes.find((b) => b.id === boxId);
  if (box?.cover) out.push({ ref: box.cover, kind: 'box' });
  for (const it of s.itemsByBox[boxId] ?? []) {
    for (const ph of it.photos ?? []) out.push({ ref: ph, kind: 'item', itemId: it.id, itemName: it.name });
  }
  return out;
};

/** Every item in the move with its room/box breadcrumb — powers Find. Fresh array: useMemo. */
export const allIndexedItems = (s: Pick<State, 'boxes' | 'rooms' | 'itemsByBox'>): IndexedItem[] => {
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
 * Pro = signed in AND an active trial (real billing will also set this later). Pro is
 * account-tied: a signed-out guest is always free, so a stale trial flag can't unlock
 * a guest. Sign-out clears the trial.
 */
export const isProNow = (s: Pick<State, 'proTrialUntil' | 'session'>): boolean =>
  s.session != null && s.proTrialUntil != null && s.proTrialUntil > Date.now();

/** What `moveSummaries` reads: the library plus the live fields of the open move. */
export type MoveSummaryInputs = Pick<
  State,
  'library' | 'currentMoveId' | 'account' | 'move' | 'boxes' | 'itemsByBox' | 'members' | 'activeMode'
>;

/**
 * One row per move for the library screen, newest-opened first. The open move is
 * summarised from the live slice (its bundle is stale by design). Fresh array: useMemo.
 */
export const moveSummaries = (s: MoveSummaryInputs): MoveSummary[] => {
  const accountId = s.account?.id ?? null;
  const out: MoveSummary[] = [];
  for (const b of Object.values(s.library)) {
    const live =
      b.id === s.currentMoveId
        ? {
            ...b,
            move: s.move,
            boxes: s.boxes,
            itemsByBox: s.itemsByBox,
            members: s.members,
            activeMode: s.activeMode,
          }
        : b;
    out.push(summarize(live, accountId));
  }
  return out.sort((a, z) => z.lastOpenedAt - a.lastOpenedAt);
};

/** The signed-in user's role in the open move (owner for local moves). */
export const currentRole = (s: State): Role => roleFor(s.activeMode, s.members, s.account?.id ?? null);

/** The data of any move: the live slice for the open one, the bundle otherwise. */
export const moveData = (s: State, id: string): SliceData | undefined =>
  id === s.currentMoveId ? extractSlice(s) : s.library[id];
