// Turning server payloads into client state. Pure.
import type { Item, Move } from '@/data/types';
import type { ServerSnapshot } from '@/lib/api';

import { newBundle, type MoveBundle } from './library';
import {
  toClientBox,
  toClientItem,
  toClientMarker,
  toClientMember,
  toClientRoom,
  toClientStatus,
} from './mappers';

/** A photo reference that still points at a file on this device (not yet uploaded). */
export const isLocalUri = (p: string): boolean =>
  p.startsWith('file://') || p.startsWith('content://') || p.startsWith('/');

/** Move details from a server snapshot. */
export function moveFromSnapshot(snap: ServerSnapshot): Move {
  return {
    name: snap.move.name,
    from: snap.move.from ?? '',
    to: snap.move.to ?? '',
    target: snap.move.targetDate ?? '',
  };
}

/** Items from a snapshot grouped by box id (every box present, even if empty). */
export function snapItemsByBox(snap: ServerSnapshot): Record<string, Item[]> {
  const out: Record<string, Item[]> = {};
  for (const b of snap.boxes) out[b.id] = [];
  for (const it of snap.items) (out[it.boxId] ??= []).push(toClientItem(it));
  return out;
}

/** A shared-move bundle for the library, freshly seeded from a snapshot. */
export function bundleFromSnapshot(
  id: string,
  serverMoveId: string,
  snap: ServerSnapshot,
  now: number,
): MoveBundle {
  return {
    ...newBundle(id, moveFromSnapshot(snap), now),
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
}

/** Upsert by id, dropping tombstoned (deletedAt) rows — used by the delta merge. */
export function mergeList<C extends { id: string }, S extends { id: string; deletedAt?: number | null }>(
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
