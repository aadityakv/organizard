import type { Mutation } from '@shared/index';
import { and, eq } from 'drizzle-orm';

import type { AppDb } from '../db/client';
import * as s from '../db/schema';
import type { Deps } from '../deps';
import { boxInMove, itemInMove, markersInMove, markerInMove, roomInMove, statusInMove } from '../repos/scope';

/**
 * Apply a batch of mutations to a move. Server time is the source of truth for
 * `updatedAt` (so delta `since` is monotonic) and last-write-wins = apply order.
 * Idempotent: a clientId already in mutation_log is skipped.
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
    await db.insert(s.mutationLog).values({ moveId, clientId: m.clientId, appliedAt: now }).onConflictDoNothing();
    applied++;
  }

  return { serverTime: now, applied };
}

async function bumpBox(db: AppDb, moveId: string, boxId: string, now: number): Promise<void> {
  await db.update(s.boxes).set({ updatedAt: now }).where(and(eq(s.boxes.id, boxId), eq(s.boxes.moveId, moveId)));
}

async function applyOne(db: AppDb, moveId: string, m: Mutation, now: number): Promise<void> {
  switch (m.type) {
    case 'addRoom': {
      const p = m.payload;
      await db.insert(s.rooms).values({ id: p.id, moveId, name: p.name, dest: p.dest ?? null, icon: p.icon, updatedAt: now, deletedAt: null }).onConflictDoNothing();
      return;
    }
    case 'updateRoom': {
      const p = m.payload;
      const set: Partial<typeof s.rooms.$inferInsert> = { updatedAt: now };
      if (p.name !== undefined) set.name = p.name;
      if (p.dest !== undefined) set.dest = p.dest;
      if (p.icon !== undefined) set.icon = p.icon;
      await db.update(s.rooms).set(set).where(and(eq(s.rooms.id, p.id), eq(s.rooms.moveId, moveId)));
      return;
    }
    case 'deleteRoom':
      await db.update(s.rooms).set({ deletedAt: now, updatedAt: now }).where(and(eq(s.rooms.id, m.payload.id), eq(s.rooms.moveId, moveId)));
      return;

    case 'addBox': {
      const p = m.payload;
      if (!(await roomInMove(db, moveId, p.roomId)) || !(await statusInMove(db, moveId, p.statusId))) return;
      await db.insert(s.boxes).values({ id: p.id, moveId, roomId: p.roomId, number: p.number, name: p.name, color: p.color, statusId: p.statusId, coverPhotoId: null, updatedAt: now, deletedAt: null }).onConflictDoNothing();
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
      await db.update(s.boxes).set(set).where(and(eq(s.boxes.id, p.id), eq(s.boxes.moveId, moveId)));
      return;
    }
    case 'deleteBox': {
      const id = m.payload.id;
      await db.update(s.boxes).set({ deletedAt: now, updatedAt: now }).where(and(eq(s.boxes.id, id), eq(s.boxes.moveId, moveId)));
      // tombstone the box's items so clients drop them too
      await db.update(s.items).set({ deletedAt: now, updatedAt: now }).where(and(eq(s.items.boxId, id), eq(s.items.moveId, moveId)));
      return;
    }
    case 'setBoxStatus': {
      if (!(await statusInMove(db, moveId, m.payload.statusId))) return;
      await db.update(s.boxes).set({ statusId: m.payload.statusId, updatedAt: now }).where(and(eq(s.boxes.id, m.payload.id), eq(s.boxes.moveId, moveId)));
      return;
    }
    case 'setBoxCover':
      await db.update(s.boxes).set({ coverPhotoId: m.payload.coverPhotoId, updatedAt: now }).where(and(eq(s.boxes.id, m.payload.id), eq(s.boxes.moveId, moveId)));
      return;
    case 'toggleBoxMarker': {
      const { boxId, markerId } = m.payload;
      if (!(await boxInMove(db, moveId, boxId)) || !(await markerInMove(db, moveId, markerId))) return;
      const existing = (
        await db.select().from(s.boxMarkers).where(and(eq(s.boxMarkers.boxId, boxId), eq(s.boxMarkers.markerId, markerId))).limit(1)
      )[0];
      if (existing) {
        await db.delete(s.boxMarkers).where(and(eq(s.boxMarkers.boxId, boxId), eq(s.boxMarkers.markerId, markerId)));
      } else {
        await db.insert(s.boxMarkers).values({ boxId, markerId }).onConflictDoNothing();
      }
      await bumpBox(db, moveId, boxId, now); // so delta resends the box with new markerIds
      return;
    }

    case 'addStatus': {
      const p = m.payload;
      await db.insert(s.statuses).values({ id: p.id, moveId, label: p.label, color: p.color, custom: true, updatedAt: now, deletedAt: null }).onConflictDoNothing();
      return;
    }
    case 'addMarker': {
      const p = m.payload;
      await db.insert(s.markers).values({ id: p.id, moveId, label: p.label, color: p.color, icon: p.icon, custom: true, updatedAt: now, deletedAt: null }).onConflictDoNothing();
      return;
    }

    case 'addItem': {
      const p = m.payload;
      if (!(await boxInMove(db, moveId, p.boxId))) return;
      await db.insert(s.items).values({ id: p.id, moveId, boxId: p.boxId, name: p.name, qty: p.qty, valueCents: p.valueCents, note: p.note ?? null, icon: p.icon ?? null, updatedAt: now, deletedAt: null }).onConflictDoNothing();
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
      await db.update(s.items).set(set).where(and(eq(s.items.id, p.id), eq(s.items.moveId, moveId)));
      if (p.markerIds !== undefined) {
        await db.delete(s.itemMarkers).where(eq(s.itemMarkers.itemId, p.id));
        for (const markerId of await markersInMove(db, moveId, p.markerIds)) {
          await db.insert(s.itemMarkers).values({ itemId: p.id, markerId }).onConflictDoNothing();
        }
      }
      return;
    }
    case 'deleteItem':
      await db.update(s.items).set({ deletedAt: now, updatedAt: now }).where(and(eq(s.items.id, m.payload.id), eq(s.items.moveId, moveId)));
      return;
  }
}
