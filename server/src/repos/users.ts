// Users: find-or-create for Apple and email identities, password accounts, display
// name and avatar color derivation, the billing entitlement, and full account
// deletion (cascades to owned moves and memberships).
import { eq } from 'drizzle-orm';

import type { AppDb } from '../db/client';
import { members, moves, users } from '../db/schema';
import { deleteMove } from './moves';

export type UserRow = typeof users.$inferSelect;

const BOX_COLORS = [
  'coral',
  'amber',
  'gold',
  'lime',
  'green',
  'teal',
  'sky',
  'indigo',
  'orchid',
  'rose',
  'clay',
  'slate',
];

function pickColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return BOX_COLORS[h % BOX_COLORS.length];
}

function deriveName(email?: string | null): string {
  const local = email?.split('@')[0];
  if (!local) return 'Friend';
  const cleaned = local.replace(/[._-]+/g, ' ').trim();
  return cleaned ? cleaned.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Friend';
}

/** User row by id. */
export async function getUserById(db: AppDb, id: string): Promise<UserRow | undefined> {
  return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
}

/** Find-or-create by Apple sub; links to an existing email account when possible. */
export async function upsertAppleUser(
  db: AppDb,
  args: { sub: string; email?: string | null; id: string; now: number },
): Promise<UserRow> {
  const bySub = (await db.select().from(users).where(eq(users.appleSub, args.sub)).limit(1))[0];
  if (bySub) return bySub;

  if (args.email) {
    const byEmail = (await db.select().from(users).where(eq(users.email, args.email)).limit(1))[0];
    if (byEmail) {
      await db.update(users).set({ appleSub: args.sub }).where(eq(users.id, byEmail.id));
      return { ...byEmail, appleSub: args.sub };
    }
  }

  const row: UserRow = {
    id: args.id,
    appleSub: args.sub,
    email: args.email ?? null,
    passwordHash: null,
    name: deriveName(args.email),
    avatarColor: pickColor(args.id),
    entitlementActive: false,
    entitlementExpiresAt: null,
    createdAt: args.now,
  };
  await db.insert(users).values(row);
  return row;
}

/** User row by (normalised) email. */
export async function getUserByEmail(db: AppDb, email: string): Promise<UserRow | undefined> {
  return (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
}

/** Create an email/password account. Caller hashes the password (lib/password). */
export async function createPasswordUser(
  db: AppDb,
  args: { email: string; passwordHash: string; id: string; now: number },
): Promise<UserRow> {
  const row: UserRow = {
    id: args.id,
    appleSub: null,
    email: args.email,
    passwordHash: args.passwordHash,
    name: deriveName(args.email),
    avatarColor: pickColor(args.id),
    entitlementActive: false,
    entitlementExpiresAt: null,
    createdAt: args.now,
  };
  await db.insert(users).values(row);
  return row;
}

/** Delete a user, the moves they own and their memberships (App Store 5.1.1(v)). */
export async function deleteUserAndData(
  db: AppDb,
  userId: string,
  deleteBlobs?: (keys: string[]) => Promise<void>,
): Promise<void> {
  const owned = await db.select({ id: moves.id }).from(moves).where(eq(moves.ownerId, userId));
  for (const m of owned) await deleteMove(db, m.id, deleteBlobs);
  await db.delete(members).where(eq(members.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

/** Set a user's subscription entitlement (driven by the RevenueCat webhook). */
export async function setEntitlement(
  db: AppDb,
  userId: string,
  active: boolean,
  expiresAt: number | null = null,
): Promise<void> {
  await db
    .update(users)
    .set({ entitlementActive: active, entitlementExpiresAt: expiresAt })
    .where(eq(users.id, userId));
}

/** Entitlement counts only while active AND not past its expiry. */
export const isEntitledNow = (
  u: { entitlementActive: boolean; entitlementExpiresAt: number | null },
  now: number,
): boolean => u.entitlementActive && (u.entitlementExpiresAt == null || u.entitlementExpiresAt > now);

/** Public shape returned to clients (no internal-only fields to hide yet, but a stable seam). */
export function toPublicUser(u: UserRow) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatarColor: u.avatarColor,
    entitlementActive: u.entitlementActive,
  };
}
