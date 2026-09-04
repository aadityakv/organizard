// Pure move-library core: no expo, no zustand. Deterministic (now/id passed in)
// so the snapshot/hydrate logic that protects against data loss is unit-tested.
import type { Box, Item, Marker, Member, Move, Role, Room, Status } from '@/data/types';
import { STARTER_MARKERS, STARTER_STATUSES } from '@/data/defaults';
import type { Mutation } from '@/shared';
import { ROLES } from '@/shared';

export const MOVE_MODE = { local: 'local', shared: 'shared' } as const;
export type MoveMode = (typeof MOVE_MODE)[keyof typeof MOVE_MODE];

/** The per-move fields mirrored into the store's live "active slice". */
export type SliceData = {
  move: Move;
  rooms: Room[];
  boxes: Box[];
  statuses: Status[];
  markers: Marker[];
  members: Member[];
  itemsByBox: Record<string, Item[]>;
  activeMode: MoveMode;
  serverMoveId: string | null;
  outbox: Mutation[];
  lastSyncTs: number;
};

/** A move at rest in the library: its data + sync state + lifecycle meta. */
export type MoveBundle = SliceData & {
  id: string;
  archived: boolean;
  createdAt: number;
  lastOpenedAt: number;
};

export type MoveSummary = {
  id: string;
  name: string;
  from: string;
  to: string;
  target: string;
  mode: MoveMode;
  role: Role;
  archived: boolean;
  boxCount: number;
  itemCount: number;
  lastOpenedAt: number;
};

const SLICE_KEYS: (keyof SliceData)[] = [
  'move',
  'rooms',
  'boxes',
  'statuses',
  'markers',
  'members',
  'itemsByBox',
  'activeMode',
  'serverMoveId',
  'outbox',
  'lastSyncTs',
];

/** Empty local move seeded with the starter statuses/markers. */
export function newBundle(id: string, move: Move, now: number): MoveBundle {
  return {
    id,
    archived: false,
    createdAt: now,
    lastOpenedAt: now,
    move,
    rooms: [],
    boxes: [],
    statuses: [...STARTER_STATUSES],
    markers: [...STARTER_MARKERS],
    members: [],
    itemsByBox: {},
    activeMode: MOVE_MODE.local,
    serverMoveId: null,
    outbox: [],
    lastSyncTs: 0,
  };
}

/** Pull just the live-slice fields out of a bundle (for hydration). */
export function sliceFromBundle(b: MoveBundle): SliceData {
  const out = {} as SliceData;
  for (const k of SLICE_KEYS) (out as Record<string, unknown>)[k] = b[k];
  return out;
}

/** Fold a live slice back onto a bundle's meta (for snapshotting on switch). */
export function snapshotInto(meta: MoveBundle, slice: SliceData, now: number): MoveBundle {
  return { ...meta, ...slice, lastOpenedAt: now };
}

/** One library row for a bundle: counts, role and lifecycle fields. */
export function summarize(b: MoveBundle, accountId: string | null = null): MoveSummary {
  let itemCount = 0;
  for (const items of Object.values(b.itemsByBox)) for (const it of items) itemCount += it.qty || 1;
  return {
    id: b.id,
    name: b.move.name,
    from: b.move.from,
    to: b.move.to,
    target: b.move.target,
    mode: b.activeMode,
    role: roleFor(b.activeMode, b.members, accountId),
    archived: b.archived,
    boxCount: b.boxes.length,
    itemCount,
    lastOpenedAt: b.lastOpenedAt,
  };
}

/** Derived role: local ⇒ owner; shared ⇒ your membership role (default viewer). */
export function roleFor(mode: MoveMode, members: Member[], accountId: string | null): Role {
  if (mode === MOVE_MODE.local) return ROLES.owner;
  return members.find((m) => m.id === accountId)?.role ?? ROLES.viewer;
}
