// Move-scope guards: confirm a payload-supplied id actually belongs to the move
// before it's written/linked. Prevents cross-move (IDOR) writes — an editor of
// move A must not be able to reference move B's rooms/boxes/statuses/markers/items.
import { and, eq, inArray } from 'drizzle-orm';

import type { AppDb } from '../db/client';
import * as s from '../db/schema';

/** Whether the room belongs to the move. */
export const roomInMove = async (db: AppDb, moveId: string, id: string): Promise<boolean> =>
  Boolean(
    (
      await db
        .select({ i: s.rooms.id })
        .from(s.rooms)
        .where(and(eq(s.rooms.id, id), eq(s.rooms.moveId, moveId)))
        .limit(1)
    )[0],
  );

/** Whether the box belongs to the move. */
export const boxInMove = async (db: AppDb, moveId: string, id: string): Promise<boolean> =>
  Boolean(
    (
      await db
        .select({ i: s.boxes.id })
        .from(s.boxes)
        .where(and(eq(s.boxes.id, id), eq(s.boxes.moveId, moveId)))
        .limit(1)
    )[0],
  );

/** Whether the status belongs to the move. */
export const statusInMove = async (db: AppDb, moveId: string, id: string): Promise<boolean> =>
  Boolean(
    (
      await db
        .select({ i: s.statuses.id })
        .from(s.statuses)
        .where(and(eq(s.statuses.id, id), eq(s.statuses.moveId, moveId)))
        .limit(1)
    )[0],
  );

/** Whether the marker belongs to the move. */
export const markerInMove = async (db: AppDb, moveId: string, id: string): Promise<boolean> =>
  Boolean(
    (
      await db
        .select({ i: s.markers.id })
        .from(s.markers)
        .where(and(eq(s.markers.id, id), eq(s.markers.moveId, moveId)))
        .limit(1)
    )[0],
  );

/** Whether the item belongs to the move. */
export const itemInMove = async (db: AppDb, moveId: string, id: string): Promise<boolean> =>
  Boolean(
    (
      await db
        .select({ i: s.items.id })
        .from(s.items)
        .where(and(eq(s.items.id, id), eq(s.items.moveId, moveId)))
        .limit(1)
    )[0],
  );

/** Whether the photo belongs to the move. */
export const photoInMove = async (db: AppDb, moveId: string, id: string): Promise<boolean> =>
  Boolean(
    (
      await db
        .select({ i: s.photos.id })
        .from(s.photos)
        .where(and(eq(s.photos.id, id), eq(s.photos.moveId, moveId)))
        .limit(1)
    )[0],
  );

/** Keep only marker ids that belong to the move. */
export async function markersInMove(db: AppDb, moveId: string, ids: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const id of ids) if (await markerInMove(db, moveId, id)) out.push(id);
  return out;
}

/** Keep only photo ids that belong to the move. */
export async function photosInMove(db: AppDb, moveId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await db
    .select({ id: s.photos.id })
    .from(s.photos)
    .where(and(eq(s.photos.moveId, moveId), inArray(s.photos.id, ids)));
  return rows.map((r) => r.id);
}
