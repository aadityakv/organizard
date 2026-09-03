import { and, eq } from 'drizzle-orm';

import type { AppDb } from '../db/client';
import * as s from '../db/schema';
import type { Deps } from '../deps';

export type PhotoRow = typeof s.photos.$inferSelect;

/**
 * Create the photo record (R2 key reserved) and bump its linked item/box so the
 * delta resends it — the snapshot derives `photoIds` from this table.
 */
export async function createPhotoRecord(
  db: AppDb,
  deps: Deps,
  args: { moveId: string; itemId?: string | null; boxId?: string | null; createdBy: string },
): Promise<{ photoId: string; r2Key: string }> {
  const id = deps.newId();
  const r2Key = `moves/${args.moveId}/${id}.jpg`;
  const now = deps.now();

  await db.insert(s.photos).values({
    id,
    moveId: args.moveId,
    itemId: args.itemId ?? null,
    boxId: args.boxId ?? null,
    r2Key,
    createdBy: args.createdBy,
    createdAt: now,
  });
  if (args.itemId)
    await db
      .update(s.items)
      .set({ updatedAt: now })
      .where(and(eq(s.items.id, args.itemId), eq(s.items.moveId, args.moveId)));
  if (args.boxId)
    await db
      .update(s.boxes)
      .set({ updatedAt: now })
      .where(and(eq(s.boxes.id, args.boxId), eq(s.boxes.moveId, args.moveId)));

  return { photoId: id, r2Key };
}

export async function getPhoto(db: AppDb, photoId: string): Promise<PhotoRow | undefined> {
  return (await db.select().from(s.photos).where(eq(s.photos.id, photoId)).limit(1))[0];
}
