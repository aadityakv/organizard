// What survives a relaunch, and how older persisted shapes are upgraded.
import { STARTER_MARKERS, STARTER_STATUSES } from '@/data/defaults';
import type { Box, Item, Marker, Member, Move, Room, Status } from '@/data/types';
import { uid } from '@/lib/uid';
import type { Mutation } from '@/shared';

import type { MoveBundle } from './library';
import { KNOWN_MUTATION_TYPES } from './mutation';
import { EMPTY_MOVE } from './shape';
import type { State, Store } from './types';

export const STORE_KEY = 'organizard-store-v1';
export const STORE_VERSION = 3;

/** The session token is deliberately NOT persisted here; it lives in the keychain. */
export const partialize = (s: Store): Partial<State> => ({
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
});

type Persisted = Partial<State> & Record<string, unknown>;

/** v2 → v3: the flat active move becomes a library. A shared move is wrapped into a bundle; anything else starts empty; unknown outbox entries are dropped. */
export function migrate(persisted: unknown, version: number): Store {
  const st = persisted as Persisted | undefined;
  if (!st) return st as unknown as Store;
  if (version >= 3) return st as Store;

  const outbox = Array.isArray(st.outbox)
    ? (st.outbox as Mutation[]).filter((m) => KNOWN_MUTATION_TYPES.has(m.type))
    : [];
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
    return { ...st, role: undefined, library: { [id]: bundle }, currentMoveId: id } as unknown as Store;
  }

  return {
    ...st,
    role: undefined,
    onboarded: false,
    library: {},
    currentMoveId: null,
    move: { ...EMPTY_MOVE },
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
