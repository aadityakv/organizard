// Read-side helpers over the store state. Selectors that return a NEW array or
// object per call are marked; feed those to useMemo over stable slices (or wrap in
// useShallow when the values are stable refs), never straight to useStore, or React
// 19 loops with "Maximum update depth exceeded".
import type { Box, IndexedItem, Item, Marker, Role, Room, Status } from '@/data/types';
import { searchDocs, type Field } from '@/lib/search';

import { roleFor, summarize, type MoveSummary, type SliceData } from './library';
import { extractSlice } from './shape';
import type { State } from './types';
import { STATUS_ID } from '@/data/defaults';

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
  sealed: s.boxes.filter((b) => b.status === STATUS_ID.sealed).length,
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

/** How far a box's unpacking has got: ticked items over all items. Fresh object: useShallow. */
export const unpackProgress = (
  s: Pick<State, 'itemsByBox'>,
  boxId: string,
): { done: number; total: number } => {
  const items = s.itemsByBox[boxId] ?? [];
  return { done: items.filter((it) => it.unpackedAt != null).length, total: items.length };
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
        boxStatus: b.status,
        roomId: b.roomId,
        roomName: room?.name ?? '',
      });
    }
  }
  return out;
};

/** Which part of an item a Find hit came from, most specific first. */
type MatchField = 'name' | 'marker' | 'note' | 'box' | 'room';

/** An indexed item plus why it matched, so the UI can explain a hit from a note or a room. */
export type FindItemHit = IndexedItem & { matchedOn: MatchField[] };

/** Narrow Find to one room and/or one box status; null and undefined both mean "any". */
export type FindFilters = { roomId?: string | null; statusId?: string | null };

// A word in the item's own name is worth twice one in its box or note; a room name
// counts least, since it matches every item in the room.
const ITEM_WEIGHT = { name: 3, marker: 2, note: 1.5, box: 1.5, room: 1 } as const;
const BOX_WEIGHT = { name: 3, room: 1 } as const;

/**
 * The Find/search match. Items hit on name, marker labels, note, box name or room
 * name; boxes on name or room name. Every query word must match somewhere (typos,
 * plurals and household synonyms allowed; see lib/search), and hits are ranked by
 * where they matched. Filters narrow both lists; with a filter on and a blank query,
 * the whole filtered set is listed in move order. One implementation so the Find tab
 * and the dashboard search can't disagree on what matches. Fresh arrays: useMemo.
 */
export function searchMove(
  s: Pick<State, 'boxes' | 'markers' | 'rooms'>,
  indexed: IndexedItem[],
  query: string,
  filters: FindFilters = {},
): { items: FindItemHit[]; boxes: Box[] } {
  const roomId = filters.roomId ?? null;
  const statusId = filters.statusId ?? null;
  const hasFilter = roomId !== null || statusId !== null;
  const q = query.trim();
  if (!q && !hasFilter) return { items: [], boxes: [] };

  const keepBox = (b: Pick<Box, 'roomId' | 'status'>): boolean =>
    (roomId === null || b.roomId === roomId) && (statusId === null || b.status === statusId);
  const items = indexed.filter((it) => keepBox({ roomId: it.roomId, status: it.boxStatus }));
  const boxes = s.boxes.filter(keepBox);
  if (!q) return { items: items.map((it) => ({ ...it, matchedOn: [] })), boxes };

  const markerLabel = (id: string): string => s.markers.find((m) => m.id === id)?.label ?? '';
  const roomName = (id: string): string => s.rooms.find((r) => r.id === id)?.name ?? '';
  const itemFields = (it: IndexedItem): Field<MatchField>[] => [
    { kind: 'name', text: it.name, weight: ITEM_WEIGHT.name },
    ...(it.markers ?? []).map((mid) => ({
      kind: 'marker' as const,
      text: markerLabel(mid),
      weight: ITEM_WEIGHT.marker,
    })),
    { kind: 'note', text: it.note ?? '', weight: ITEM_WEIGHT.note },
    { kind: 'box', text: it.boxName, weight: ITEM_WEIGHT.box },
    { kind: 'room', text: it.roomName, weight: ITEM_WEIGHT.room },
  ];
  const boxFields = (b: Box): Field<'name' | 'room'>[] => [
    { kind: 'name', text: b.name, weight: BOX_WEIGHT.name },
    { kind: 'room', text: roomName(b.roomId), weight: BOX_WEIGHT.room },
  ];
  return {
    items: searchDocs(q, items, itemFields).map((h) => ({ ...h.doc, matchedOn: h.matched })),
    boxes: searchDocs(q, boxes, boxFields).map((h) => h.doc),
  };
}

/** Pro = the server says the account is entitled, or an unexpired local trial. */
export const isProNow = (s: Pick<State, 'proTrialUntil' | 'session' | 'account'>): boolean =>
  s.session != null &&
  (s.account?.entitlementActive === true || (s.proTrialUntil != null && s.proTrialUntil > Date.now()));

/** What `moveSummaries` reads: the library plus the live fields of the open move. */
export type MoveSummaryInputs = Pick<
  State,
  'library' | 'currentMoveId' | 'account' | 'move' | 'boxes' | 'itemsByBox' | 'members' | 'activeMode'
>;

/** One row per move, newest-opened first; the open move is summarised from the live slice. Fresh array: useMemo. */
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

/**
 * Up to three things the user might search for, drawn from their own data: the most
 * recently added item names, then labels of markers actually in use. Fresh array: useMemo.
 */
export const searchSuggestions = (
  s: Pick<State, 'boxes' | 'itemsByBox' | 'markers'>,
  limit = 3,
): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (label: string) => {
    const key = label.trim().toLowerCase();
    if (!key || seen.has(key) || out.length >= limit) return;
    seen.add(key);
    out.push(label.trim());
  };
  const items = Object.values(s.itemsByBox).flat();
  for (let i = items.length - 1; i >= 0; i--) add(items[i].name);
  const usedMarkers = new Set(
    s.boxes.flatMap((b) => b.markers).concat(items.flatMap((it) => it.markers ?? [])),
  );
  for (const m of s.markers) if (usedMarkers.has(m.id)) add(m.label);
  return out;
};

/** The signed-in user's role in the open move (owner for local moves). */
export const currentRole = (s: State): Role => roleFor(s.activeMode, s.members, s.account?.id ?? null);

/** The data of any move: the live slice for the open one, the bundle otherwise. */
export const moveData = (s: State, id: string): SliceData | undefined =>
  id === s.currentMoveId ? extractSlice(s) : s.library[id];
