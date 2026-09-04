// Move persistence: create (with owner membership and seeded statuses/markers), the
// full snapshot a client opens with, changes-since-cursor for delta sync, hard delete
// in FK-safe order, and the list of moves a user belongs to.
import {
  ROLES,
  type Box,
  type Item,
  type Marker,
  type Member,
  type Move,
  type Role,
  type Room,
  type Status,
} from '@shared/index';
import { and, eq, gt, inArray, isNull } from 'drizzle-orm';

import type { AppDb } from '../db/client';
import * as s from '../db/schema';
import type { Deps } from '../deps';
import { DEFAULT_MARKERS, DEFAULT_STATUSES } from '../defaults';

export type Membership = { role: Role };
export type Snapshot = {
  move: Move;
  members: Member[];
  rooms: Room[];
  statuses: Status[];
  markers: Marker[];
  boxes: Box[];
  items: Item[];
};
export type Changes = {
  serverTime: number;
  /** Opaque cursor — pass back as `since`. (Unbounded delta; hasMore is always false for now.) */
  cursor: number;
  hasMore: boolean;
  /** The move row itself when it changed since the cursor (rename, address/date edit); else null. */
  move: Move | null;
  rooms: Room[];
  statuses: Status[];
  markers: Marker[];
  boxes: Box[];
  items: Item[];
  members: Member[];
};

/** The user's membership in a move, or null if they are not a member. */
export async function getMembership(db: AppDb, moveId: string, userId: string): Promise<Membership | null> {
  const row = (
    await db
      .select()
      .from(s.members)
      .where(and(eq(s.members.moveId, moveId), eq(s.members.userId, userId)))
      .limit(1)
  )[0];
  return row ? { role: row.role } : null;
}

/** Create a shared move with its owner membership, seeding default statuses/markers unless `seed: false`.
 *
 * `clientId` (the local move's id) makes creation idempotent: if this owner already
 * created a server move for that clientId — e.g. the app died between create and
 * persisting the serverMoveId, then the user retried — the existing move is reused
 * instead of minting a duplicate.
 */
export async function createMove(
  db: AppDb,
  deps: Deps,
  args: {
    name: string;
    from?: string | null;
    to?: string | null;
    targetDate?: string | null;
    ownerId: string;
    seed?: boolean;
    clientId?: string;
  },
): Promise<string> {
  const findByClientId = async (): Promise<string | undefined> =>
    (
      await db
        .select({ id: s.moves.id })
        .from(s.moves)
        .where(and(eq(s.moves.ownerId, args.ownerId), eq(s.moves.clientId, args.clientId as string)))
        .limit(1)
    )[0]?.id;

  let moveId = args.clientId ? await findByClientId() : undefined;
  let created = false;

  if (!moveId) {
    const now = deps.now();
    const id = deps.newId();
    try {
      await db.insert(s.moves).values({
        id,
        name: args.name,
        fromAddr: args.from ?? null,
        toAddr: args.to ?? null,
        targetDate: args.targetDate ?? null,
        ownerId: args.ownerId,
        clientId: args.clientId ?? null,
        createdAt: now,
        updatedAt: now,
      });
      moveId = id;
      created = true;
    } catch (e) {
      // Only the (owner_id, client_id) unique-index race is recoverable by reusing
      // the winner; without a clientId nothing can be recovered — rethrow as-is.
      if (!args.clientId) throw e;
      moveId = await findByClientId();
      if (!moveId) throw e;
    }
  }

  // The owner membership is a separate insert from the move row. Always upsert it:
  // a worker crash between the two would otherwise leave a membership-less move
  // that the clientId fast-path above would return on every retry — locking the
  // owner out of their own move (membership checks 404 for non-members).
  await db
    .insert(s.members)
    .values({ id: deps.newId(), moveId, userId: args.ownerId, role: ROLES.owner, createdAt: deps.now() })
    .onConflictDoNothing();

  // Seed only a freshly created move: a reused one already seeded (or intentionally
  // skipped) on its first create, and fresh ids would duplicate the rows.
  if (created && args.seed !== false) {
    const now = deps.now();
    for (const st of DEFAULT_STATUSES) {
      await db.insert(s.statuses).values({
        id: deps.newId(),
        moveId,
        label: st.label,
        color: st.color,
        custom: false,
        updatedAt: now,
        deletedAt: null,
      });
    }
    for (const mk of DEFAULT_MARKERS) {
      await db.insert(s.markers).values({
        id: deps.newId(),
        moveId,
        label: mk.label,
        color: mk.color,
        icon: mk.icon,
        custom: false,
        updatedAt: now,
        deletedAt: null,
      });
    }
  }
  return moveId;
}

async function getMembers(db: AppDb, moveId: string): Promise<Member[]> {
  const memberRows = await db.select().from(s.members).where(eq(s.members.moveId, moveId));
  const userIds = memberRows.map((m) => m.userId);
  const userRows = userIds.length ? await db.select().from(s.users).where(inArray(s.users.id, userIds)) : [];
  const nameById = new Map(userRows.map((u) => [u.id, u.name]));
  return memberRows.map((m) => ({
    id: m.id,
    moveId: m.moveId,
    userId: m.userId,
    role: m.role,
    name: nameById.get(m.userId) ?? 'Friend',
  }));
}

const toMove = (m: typeof s.moves.$inferSelect): Move => ({
  id: m.id,
  name: m.name,
  from: m.fromAddr,
  to: m.toAddr,
  targetDate: m.targetDate,
  ownerId: m.ownerId,
  clientId: m.clientId,
  updatedAt: m.updatedAt,
});

const toRoom = (r: typeof s.rooms.$inferSelect): Room => ({
  id: r.id,
  moveId: r.moveId,
  name: r.name,
  dest: r.dest,
  icon: r.icon,
  color: r.color,
  updatedAt: r.updatedAt,
  deletedAt: r.deletedAt,
});
const toStatus = (r: typeof s.statuses.$inferSelect): Status => ({
  id: r.id,
  moveId: r.moveId,
  label: r.label,
  color: r.color,
  custom: r.custom,
  updatedAt: r.updatedAt,
  deletedAt: r.deletedAt,
});
const toMarker = (r: typeof s.markers.$inferSelect): Marker => ({
  id: r.id,
  moveId: r.moveId,
  label: r.label,
  color: r.color,
  icon: r.icon,
  custom: r.custom,
  updatedAt: r.updatedAt,
  deletedAt: r.deletedAt,
});
const toBox = (r: typeof s.boxes.$inferSelect, markerIds: string[]): Box => ({
  id: r.id,
  moveId: r.moveId,
  roomId: r.roomId,
  number: r.number,
  name: r.name,
  color: r.color,
  statusId: r.statusId,
  coverPhotoId: r.coverPhotoId,
  markerIds,
  updatedAt: r.updatedAt,
  deletedAt: r.deletedAt,
});
const toItem = (r: typeof s.items.$inferSelect, markerIds: string[], photoIds: string[]): Item => ({
  id: r.id,
  moveId: r.moveId,
  boxId: r.boxId,
  name: r.name,
  qty: r.qty,
  valueCents: r.valueCents,
  note: r.note,
  icon: r.icon,
  markerIds,
  photoIds,
  updatedAt: r.updatedAt,
  deletedAt: r.deletedAt,
});

async function groupJoin(rows: { left: string; right: string }[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const arr = map.get(r.left) ?? [];
    arr.push(r.right);
    map.set(r.left, arr);
  }
  return map;
}

async function boxMarkerMap(db: AppDb, boxIds: string[]): Promise<Map<string, string[]>> {
  if (!boxIds.length) return new Map();
  const rows = await db.select().from(s.boxMarkers).where(inArray(s.boxMarkers.boxId, boxIds));
  return groupJoin(rows.map((r) => ({ left: r.boxId, right: r.markerId })));
}
async function itemMarkerMap(db: AppDb, itemIds: string[]): Promise<Map<string, string[]>> {
  if (!itemIds.length) return new Map();
  const rows = await db.select().from(s.itemMarkers).where(inArray(s.itemMarkers.itemId, itemIds));
  return groupJoin(rows.map((r) => ({ left: r.itemId, right: r.markerId })));
}
async function itemPhotoMap(db: AppDb, itemIds: string[]): Promise<Map<string, string[]>> {
  if (!itemIds.length) return new Map();
  const rows = await db.select().from(s.photos).where(inArray(s.photos.itemId, itemIds));
  // A reserved-but-never-uploaded photo would render as a broken image; leave it out.
  return groupJoin(
    rows
      .filter((r) => r.itemId && r.uploadedAt != null)
      .map((r) => ({ left: r.itemId as string, right: r.id })),
  );
}

/** Everything a client needs to open a move, or null if it does not exist. */
export async function getMoveSnapshot(db: AppDb, moveId: string): Promise<Snapshot | null> {
  const move = (await db.select().from(s.moves).where(eq(s.moves.id, moveId)).limit(1))[0];
  if (!move) return null;

  const members = await getMembers(db, moveId);

  const rooms = (
    await db
      .select()
      .from(s.rooms)
      .where(and(eq(s.rooms.moveId, moveId), isNull(s.rooms.deletedAt)))
  ).map(toRoom);
  const statuses = (
    await db
      .select()
      .from(s.statuses)
      .where(and(eq(s.statuses.moveId, moveId), isNull(s.statuses.deletedAt)))
  ).map(toStatus);
  const markers = (
    await db
      .select()
      .from(s.markers)
      .where(and(eq(s.markers.moveId, moveId), isNull(s.markers.deletedAt)))
  ).map(toMarker);

  const boxRows = await db
    .select()
    .from(s.boxes)
    .where(and(eq(s.boxes.moveId, moveId), isNull(s.boxes.deletedAt)));
  const itemRows = await db
    .select()
    .from(s.items)
    .where(and(eq(s.items.moveId, moveId), isNull(s.items.deletedAt)));
  const bm = await boxMarkerMap(
    db,
    boxRows.map((b) => b.id),
  );
  const im = await itemMarkerMap(
    db,
    itemRows.map((i) => i.id),
  );
  const ip = await itemPhotoMap(
    db,
    itemRows.map((i) => i.id),
  );

  return {
    move: toMove(move),
    members,
    rooms,
    statuses,
    markers,
    boxes: boxRows.map((b) => toBox(b, bm.get(b.id) ?? [])),
    items: itemRows.map((i) => toItem(i, im.get(i.id) ?? [], ip.get(i.id) ?? [])),
  };
}

/** All rows changed after `since`, including tombstones. Unbounded: moves are small. */
export async function getChangesSince(
  db: AppDb,
  deps: Deps,
  moveId: string,
  since: number,
): Promise<Changes> {
  const serverTime = deps.now();

  // The move row itself rides the delta only when it changed (rename/address/date).
  const moveRow = (
    await db
      .select()
      .from(s.moves)
      .where(and(eq(s.moves.id, moveId), gt(s.moves.updatedAt, since)))
      .limit(1)
  )[0];

  const rooms = (
    await db
      .select()
      .from(s.rooms)
      .where(and(eq(s.rooms.moveId, moveId), gt(s.rooms.updatedAt, since)))
  ).map(toRoom);
  const statuses = (
    await db
      .select()
      .from(s.statuses)
      .where(and(eq(s.statuses.moveId, moveId), gt(s.statuses.updatedAt, since)))
  ).map(toStatus);
  const markers = (
    await db
      .select()
      .from(s.markers)
      .where(and(eq(s.markers.moveId, moveId), gt(s.markers.updatedAt, since)))
  ).map(toMarker);

  const boxRows = await db
    .select()
    .from(s.boxes)
    .where(and(eq(s.boxes.moveId, moveId), gt(s.boxes.updatedAt, since)));
  const itemRows = await db
    .select()
    .from(s.items)
    .where(and(eq(s.items.moveId, moveId), gt(s.items.updatedAt, since)));
  const bm = await boxMarkerMap(
    db,
    boxRows.map((b) => b.id),
  );
  const im = await itemMarkerMap(
    db,
    itemRows.map((i) => i.id),
  );
  const ip = await itemPhotoMap(
    db,
    itemRows.map((i) => i.id),
  );

  return {
    serverTime,
    // serverTime-1 so a row written in the same ms as this read is re-included on the
    // next poll (healed by the regular 15s poll, not only the foreground full-resync).
    cursor: serverTime - 1,
    hasMore: false,
    move: moveRow ? toMove(moveRow) : null,
    rooms,
    statuses,
    markers,
    boxes: boxRows.map((b) => toBox(b, bm.get(b.id) ?? [])),
    items: itemRows.map((i) => toItem(i, im.get(i.id) ?? [], ip.get(i.id) ?? [])),
    members: await getMembers(db, moveId), // full list each delta (small); covers invite/role/remove
  };
}

/** Hard-delete a move and its children in FK-safe order (there are no cascade FKs).
 *
 * `deleteBlobs` (wired to R2 by the routes) removes the photo objects — the DB rows
 * alone don't free the blobs, and the privacy policy promises both go away.
 */
export async function deleteMove(
  db: AppDb,
  moveId: string,
  deleteBlobs?: (keys: string[]) => Promise<void>,
): Promise<void> {
  const r2Keys = (
    await db.select({ r2Key: s.photos.r2Key }).from(s.photos).where(eq(s.photos.moveId, moveId))
  ).map((r) => r.r2Key);
  const boxIds = (await db.select({ id: s.boxes.id }).from(s.boxes).where(eq(s.boxes.moveId, moveId))).map(
    (r) => r.id,
  );
  const itemIds = (await db.select({ id: s.items.id }).from(s.items).where(eq(s.items.moveId, moveId))).map(
    (r) => r.id,
  );
  if (itemIds.length) await db.delete(s.itemMarkers).where(inArray(s.itemMarkers.itemId, itemIds));
  if (boxIds.length) await db.delete(s.boxMarkers).where(inArray(s.boxMarkers.boxId, boxIds));
  await db.delete(s.items).where(eq(s.items.moveId, moveId));
  await db.delete(s.boxes).where(eq(s.boxes.moveId, moveId));
  await db.delete(s.rooms).where(eq(s.rooms.moveId, moveId));
  await db.delete(s.statuses).where(eq(s.statuses.moveId, moveId));
  await db.delete(s.markers).where(eq(s.markers.moveId, moveId));
  await db.delete(s.photos).where(eq(s.photos.moveId, moveId));
  await db.delete(s.invites).where(eq(s.invites.moveId, moveId));
  await db.delete(s.members).where(eq(s.members.moveId, moveId));
  await db.delete(s.mutationLog).where(eq(s.mutationLog.moveId, moveId));
  await db.delete(s.moves).where(eq(s.moves.id, moveId));
  if (deleteBlobs && r2Keys.length) await deleteBlobs(r2Keys);
}

/** Moves the user belongs to, with their role. */
export async function getUserMoves(db: AppDb, userId: string): Promise<(Move & { role: Role })[]> {
  const memberRows = await db.select().from(s.members).where(eq(s.members.userId, userId));
  if (!memberRows.length) return [];
  const moveRows = await db
    .select()
    .from(s.moves)
    .where(
      inArray(
        s.moves.id,
        memberRows.map((m) => m.moveId),
      ),
    );
  const roleByMove = new Map(memberRows.map((m) => [m.moveId, m.role]));
  return moveRows.map((m) => ({ ...toMove(m), role: roleByMove.get(m.id) ?? ROLES.viewer }));
}
