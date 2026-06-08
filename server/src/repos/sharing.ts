import type { Role } from '@shared/index';
import { and, eq } from 'drizzle-orm';

import type { AppDb } from '../db/client';
import * as s from '../db/schema';
import type { Deps } from '../deps';

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export async function createInvite(
  db: AppDb,
  deps: Deps,
  args: { moveId: string; role: Role; createdBy: string },
): Promise<{ token: string; role: Role; expiresAt: number }> {
  const token = deps.newToken();
  const expiresAt = deps.now() + INVITE_TTL_MS;
  await db.insert(s.invites).values({
    id: deps.newId(),
    moveId: args.moveId,
    role: args.role,
    token,
    createdBy: args.createdBy,
    expiresAt,
    acceptedBy: null,
  });
  return { token, role: args.role, expiresAt };
}

export type AcceptResult = { moveId: string } | { error: 'INVITE_INVALID' | 'INVITE_USED' | 'INVITE_EXPIRED' };

export async function acceptInvite(db: AppDb, deps: Deps, args: { token: string; userId: string }): Promise<AcceptResult> {
  const inv = (await db.select().from(s.invites).where(eq(s.invites.token, args.token)).limit(1))[0];
  if (!inv) return { error: 'INVITE_INVALID' };
  if (inv.acceptedBy) return { error: 'INVITE_USED' };
  if (inv.expiresAt < deps.now()) return { error: 'INVITE_EXPIRED' };

  const existing = (
    await db.select().from(s.members).where(and(eq(s.members.moveId, inv.moveId), eq(s.members.userId, args.userId))).limit(1)
  )[0];
  if (!existing) {
    await db.insert(s.members).values({ id: deps.newId(), moveId: inv.moveId, userId: args.userId, role: inv.role, createdAt: deps.now() });
  }
  await db.update(s.invites).set({ acceptedBy: args.userId }).where(eq(s.invites.id, inv.id));
  return { moveId: inv.moveId };
}

export async function getMoveOwnerId(db: AppDb, moveId: string): Promise<string | undefined> {
  const move = (await db.select().from(s.moves).where(eq(s.moves.id, moveId)).limit(1))[0];
  return move?.ownerId;
}

/** A shared move is editable only while its owner's subscription is active. */
export async function isOwnerEntitled(db: AppDb, moveId: string): Promise<boolean> {
  const move = (await db.select().from(s.moves).where(eq(s.moves.id, moveId)).limit(1))[0];
  if (!move) return false;
  const owner = (await db.select().from(s.users).where(eq(s.users.id, move.ownerId)).limit(1))[0];
  return Boolean(owner?.entitlementActive);
}

export async function changeMemberRole(db: AppDb, args: { moveId: string; userId: string; role: Role }): Promise<void> {
  await db.update(s.members).set({ role: args.role }).where(and(eq(s.members.moveId, args.moveId), eq(s.members.userId, args.userId)));
}

export async function removeMember(db: AppDb, args: { moveId: string; userId: string }): Promise<void> {
  await db.delete(s.members).where(and(eq(s.members.moveId, args.moveId), eq(s.members.userId, args.userId)));
}
