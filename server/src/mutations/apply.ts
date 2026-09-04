// The server half of the sync contract: apply a batch of client mutations to a move.
import type { Mutation } from '@shared/index';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import type { AppDb } from '../db/client';
import * as s from '../db/schema';
import type { Deps } from '../deps';
import {
  boxInMove,
  itemInMove,
  markersInMove,
  markerInMove,
  photoInMove,
  photosInMove,
  roomInMove,
  statusInMove,
} from '../repos/scope';

/** Apply a mutation batch in order; a clientId already in mutation_log is skipped, so retries are safe.
 *
 * Idempotency is check-then-act: two concurrent retries of the same clientId could both pass the
 * check. That is acceptable because every operation is itself idempotent (inserts are
 * onConflictDoNothing, updates set full columns, setBoxMarker is intent-based) — the worst case is
 * the same logical change applied twice with the same result.
 */
export async function applyMutations(
  db: AppDb,
  deps: Deps,
  moveId: string,
  mutations: Mutation[],
): Promise<{ serverTime: number; applied: number }> {
  const now = deps.now();
  let applied = 0;

  for (const m of mutations) {
    const seen = (
      await db
        .select()
        .from(s.mutationLog)
        .where(and(eq(s.mutationLog.moveId, moveId), eq(s.mutationLog.clientId, m.clientId)))
        .limit(1)
    )[0];
    if (seen) continue;

    await applyOne(db, moveId, m, now);
    await db
      .insert(s.mutationLog)
      .values({ moveId, clientId: m.clientId, appliedAt: now })
      .onConflictDoNothing();
    applied += 1;
  }

  return { serverTime: now, applied };
}

async function bumpBox(db: AppDb, moveId: string, boxId: string, now: number): Promise<void> {
  await db
    .update(s.boxes)
    .set({ updatedAt: now })
    .where(and(eq(s.boxes.id, boxId), eq(s.boxes.moveId, moveId)));
}

async function applyOne(db: AppDb, moveId: string, m: Mutation, now: number): Promise<void> {
  switch (m.type) {
    case 'addRoom': {
      const p = m.payload;
      await db
        .insert(s.rooms)
        .values({
          id: p.id,
          moveId,
          name: p.name,
          dest: p.dest ?? null,
          icon: p.icon,
          color: p.color ?? 'slate',
          updatedAt: now,
          deletedAt: null,
        })
        .onConflictDoNothing();
      return;
    }
    case 'updateRoom': {
      const p = m.payload;
      const set: Partial<typeof s.rooms.$inferInsert> = { updatedAt: now };
      if (p.name !== undefined) set.name = p.name;
      if (p.dest !== undefined) set.dest = p.dest;
      if (p.icon !== undefined) set.icon = p.icon;
      if (p.color !== undefined) set.color = p.color;
      await db
        .update(s.rooms)
        .set(set)
        .where(and(eq(s.rooms.id, p.id), eq(s.rooms.moveId, moveId)));
      return;
    }
    case 'deleteRoom': {
      // Like deleteBox, tombstone the children too: a deleted room's boxes (and
      // their items) must not linger as live orphans in snapshots/deltas.
      const roomId = m.payload.id;
      await db
        .update(s.rooms)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(s.rooms.id, roomId), eq(s.rooms.moveId, moveId)));
      const boxIds = (
        await db
          .select({ id: s.boxes.id })
          .from(s.boxes)
          .where(and(eq(s.boxes.roomId, roomId), eq(s.boxes.moveId, moveId), isNull(s.boxes.deletedAt)))
      ).map((r) => r.id);
      if (boxIds.length) {
        await db
          .update(s.boxes)
          .set({ deletedAt: now, updatedAt: now })
          .where(and(eq(s.boxes.moveId, moveId), inArray(s.boxes.id, boxIds)));
        await db
          .update(s.items)
          .set({ deletedAt: now, updatedAt: now })
          .where(and(eq(s.items.moveId, moveId), inArray(s.items.boxId, boxIds)));
      }
      return;
    }

    case 'addBox': {
      const p = m.payload;
      if (!(await roomInMove(db, moveId, p.roomId)) || !(await statusInMove(db, moveId, p.statusId))) return;
      await db
        .insert(s.boxes)
        .values({
          id: p.id,
          moveId,
          roomId: p.roomId,
          number: p.number,
          name: p.name,
          color: p.color,
          statusId: p.statusId,
          coverPhotoId: null,
          updatedAt: now,
          deletedAt: null,
        })
        .onConflictDoNothing();
      return;
    }
    case 'updateBox': {
      const p = m.payload;
      const set: Partial<typeof s.boxes.$inferInsert> = { updatedAt: now };
      if (p.name !== undefined) set.name = p.name;
      if (p.color !== undefined) set.color = p.color;
      if (p.roomId !== undefined) {
        if (!(await roomInMove(db, moveId, p.roomId))) return;
        set.roomId = p.roomId;
      }
      await db
        .update(s.boxes)
        .set(set)
        .where(and(eq(s.boxes.id, p.id), eq(s.boxes.moveId, moveId)));
      return;
    }
    case 'deleteBox': {
      const id = m.payload.id;
      await db
        .update(s.boxes)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(s.boxes.id, id), eq(s.boxes.moveId, moveId)));
      // tombstone the box's items so clients drop them too
      await db
        .update(s.items)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(s.items.boxId, id), eq(s.items.moveId, moveId)));
      return;
    }
    case 'setBoxStatus': {
      if (!(await statusInMove(db, moveId, m.payload.statusId))) return;
      await db
        .update(s.boxes)
        .set({ statusId: m.payload.statusId, updatedAt: now })
        .where(and(eq(s.boxes.id, m.payload.id), eq(s.boxes.moveId, moveId)));
      return;
    }
    case 'setBoxCover':
      // A non-null cover must reference a photo in THIS move (no cross-move/foreign ids).
      if (m.payload.coverPhotoId && !(await photoInMove(db, moveId, m.payload.coverPhotoId))) return;
      await db
        .update(s.boxes)
        .set({ coverPhotoId: m.payload.coverPhotoId, updatedAt: now })
        .where(and(eq(s.boxes.id, m.payload.id), eq(s.boxes.moveId, moveId)));
      return;
    case 'setBoxMarker': {
      // Intent-based (on/off), so applying twice is idempotent (no double-apply flip).
      const { boxId, markerId, on } = m.payload;
      if (!(await boxInMove(db, moveId, boxId)) || !(await markerInMove(db, moveId, markerId))) return;
      if (on) {
        await db.insert(s.boxMarkers).values({ boxId, markerId }).onConflictDoNothing();
      } else {
        await db
          .delete(s.boxMarkers)
          .where(and(eq(s.boxMarkers.boxId, boxId), eq(s.boxMarkers.markerId, markerId)));
      }
      await bumpBox(db, moveId, boxId, now); // so delta resends the box with new markerIds
      return;
    }

    case 'addStatus': {
      const p = m.payload;
      await db
        .insert(s.statuses)
        .values({
          id: p.id,
          moveId,
          label: p.label,
          color: p.color,
          custom: true,
          updatedAt: now,
          deletedAt: null,
        })
        .onConflictDoNothing();
      return;
    }
    case 'addMarker': {
      const p = m.payload;
      await db
        .insert(s.markers)
        .values({
          id: p.id,
          moveId,
          label: p.label,
          color: p.color,
          icon: p.icon,
          custom: true,
          updatedAt: now,
          deletedAt: null,
        })
        .onConflictDoNothing();
      return;
    }

    case 'addItem': {
      const p = m.payload;
      if (!(await boxInMove(db, moveId, p.boxId))) return;
      await db
        .insert(s.items)
        .values({
          id: p.id,
          moveId,
          boxId: p.boxId,
          name: p.name,
          qty: p.qty,
          valueCents: p.valueCents,
          note: p.note ?? null,
          icon: p.icon ?? null,
          updatedAt: now,
          deletedAt: null,
        })
        .onConflictDoNothing();
      for (const markerId of await markersInMove(db, moveId, p.markerIds ?? [])) {
        await db.insert(s.itemMarkers).values({ itemId: p.id, markerId }).onConflictDoNothing();
      }
      return;
    }
    case 'updateItem': {
      const p = m.payload;
      if (!(await itemInMove(db, moveId, p.id))) return;
      const set: Partial<typeof s.items.$inferInsert> = { updatedAt: now };
      if (p.name !== undefined) set.name = p.name;
      if (p.qty !== undefined) set.qty = p.qty;
      if (p.valueCents !== undefined) set.valueCents = p.valueCents;
      if (p.note !== undefined) set.note = p.note;
      await db
        .update(s.items)
        .set(set)
        .where(and(eq(s.items.id, p.id), eq(s.items.moveId, moveId)));
      if (p.markerIds !== undefined) {
        await db.delete(s.itemMarkers).where(eq(s.itemMarkers.itemId, p.id));
        for (const markerId of await markersInMove(db, moveId, p.markerIds)) {
          await db.insert(s.itemMarkers).values({ itemId: p.id, markerId }).onConflictDoNothing();
        }
      }
      if (p.photoIds !== undefined) {
        // Replace the item's photo links with the given set (cross-move ids dropped).
        const wanted = new Set(await photosInMove(db, moveId, p.photoIds));
        const linked = await db.select({ id: s.photos.id }).from(s.photos).where(eq(s.photos.itemId, p.id));
        const unlink = linked.map((r) => r.id).filter((id) => !wanted.has(id));
        if (unlink.length)
          await db.update(s.photos).set({ itemId: null }).where(inArray(s.photos.id, unlink));
        if (wanted.size)
          await db
            .update(s.photos)
            .set({ itemId: p.id })
            .where(inArray(s.photos.id, [...wanted]));
      }
      return;
    }
    case 'deleteItem':
      await db
        .update(s.items)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(s.items.id, m.payload.id), eq(s.items.moveId, moveId)));
      return;
    case 'moveItem': {
      const p = m.payload;
      if (!(await itemInMove(db, moveId, p.id)) || !(await boxInMove(db, moveId, p.toBoxId))) return;
      await db
        .update(s.items)
        .set({ boxId: p.toBoxId, updatedAt: now })
        .where(and(eq(s.items.id, p.id), eq(s.items.moveId, moveId)));
      return;
    }
    case 'updateMove': {
      // One move per moveId — update its row in place. `target` maps to the
      // `targetDate` column; `from`/`to` to `fromAddr`/`toAddr`.
      const p = m.payload;
      const set: Partial<typeof s.moves.$inferInsert> = { updatedAt: now };
      if (p.name !== undefined) set.name = p.name;
      if (p.from !== undefined) set.fromAddr = p.from;
      if (p.to !== undefined) set.toAddr = p.to;
      if (p.target !== undefined) set.targetDate = p.target;
      await db.update(s.moves).set(set).where(eq(s.moves.id, moveId));
      return;
    }
  }
}
