// The initial state and the helpers that move data between the live slice and the
// library. Pure; shared by the slices and the persist migration.
import { STARTER_MARKERS, STARTER_STATUSES } from '@/data/defaults';
import type { Move } from '@/data/types';

import { newBundle, sliceFromBundle, snapshotInto, type MoveBundle, type SliceData } from './library';
import type { State } from './types';

export const EMPTY_MOVE: Move = { name: '', from: '', to: '', target: '' };

export const initialState: State = {
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

/** Pull the live-slice fields off the full store state. */
export function extractSlice(s: State): SliceData {
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

/** The live slice with no move open. */
export const emptyLiveSlice = (now: number): SliceData =>
  sliceFromBundle(newBundle('__none__', EMPTY_MOVE, now));

/** The library with the open move's live state written back into its bundle; call before switching away. */
export function parkCurrentMove(s: State, now: number): Record<string, MoveBundle> {
  const library = { ...s.library };
  if (s.currentMoveId && library[s.currentMoveId]) {
    library[s.currentMoveId] = snapshotInto(library[s.currentMoveId], extractSlice(s), now);
  }
  return library;
}
