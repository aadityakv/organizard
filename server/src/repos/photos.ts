// Photo rows: metadata plus the link to an item or box. Bytes live in R2 under the
// photo id; creating a record reserves the key before the upload happens.
import { and, eq } from 'drizzle-orm';

import type { AppDb } from '../db/client';
import * as s from '../db/schema';
import type { Deps } from '../deps';

export type PhotoRow = typeof s.photos.$inferSelect;

/** Reserve a photo record and bump its linked item/box so the next delta resends it. */
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
  return { photoId: id, r2Key };
}

/** Record that the bytes are in R2 and bump the linked row so the next delta carries the photo. */
export async function markPhotoUploaded(db: AppDb, photo: PhotoRow, now: number): Promise<void> {
  await db.update(s.photos).set({ uploadedAt: now }).where(eq(s.photos.id, photo.id));
  if (photo.itemId)
    await db
      .update(s.items)
      .set({ updatedAt: now })
      .where(and(eq(s.items.id, photo.itemId), eq(s.items.moveId, photo.moveId)));
  if (photo.boxId)
    await db
      .update(s.boxes)
      .set({ updatedAt: now })
      .where(and(eq(s.boxes.id, photo.boxId), eq(s.boxes.moveId, photo.moveId)));
}

/** Photo row by id. */
export async function getPhoto(db: AppDb, photoId: string): Promise<PhotoRow | undefined> {
  return (await db.select().from(s.photos).where(eq(s.photos.id, photoId)).limit(1))[0];
}
