import type { Role } from '@shared/index';
import { eq } from 'drizzle-orm';

import { createApp } from '../../src/app';
import * as schema from '../../src/db/schema';
import type { AppleIdentity } from '../../src/lib/apple';
import type { Env } from '../../src/types';
import { makeTestDb } from './db';
import { makeMemoryKv } from './kv';
import { makeMemoryR2 } from './r2';

/** A wired app with in-memory DB/KV/R2 and stubbed Apple/email/time/ids. */
export async function makeHarness(opts: { now?: number; billing?: boolean } = {}) {
  const db = await makeTestDb();
  const kv = makeMemoryKv();
  const r2 = makeMemoryR2();
  let appleNext: AppleIdentity | null = null; // null => verify throws

  let idN = 0;
  let tokN = 0;
  let seedN = 0;

  const env: Env = {
    DB: undefined as unknown as D1Database,
    PHOTOS: r2,
    SESSIONS: kv,
    APP_URL: 'organizard://auth',
    REVENUECAT_WEBHOOK_SECRET: 'test-secret',
    // Default billing ON in tests so entitlement paths stay exercised; flip off
    // with makeHarness({ billing: false }) to test the free (default-prod) path.
    BILLING_ENABLED: opts.billing === false ? undefined : 'true',
  };

  const app = createApp({
    getDb: () => db,
    now: () => opts.now ?? 1_700_000_000_000,
    newId: () => `id_${idN++}`,
    newToken: () => `tok_${tokN++}`,
    verifyApple: async () => {
      if (!appleNext) throw new Error('invalid apple token');
      return appleNext;
    },
  });

  const setAppleIdentity = (id: AppleIdentity) => {
    appleNext = id;
  };
  const request = (path: string, init?: RequestInit) => app.request(path, init, env);
  const json = (path: string, body: unknown, init: RequestInit = {}) =>
    app.request(
      path,
      {
        method: 'POST',
        ...init,
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
      },
      env,
    );

  const setEntitled = async (userId: string, on: boolean) => {
    await db.update(schema.users).set({ entitlementActive: on }).where(eq(schema.users.id, userId));
  };

  /** Sign in via Apple and return the session + user. Entitled by default. */
  const login = async (sub: string, email: string, opts: { entitled?: boolean } = {}) => {
    setAppleIdentity({ sub, email });
    const res = await json('/v1/auth/apple', { identityToken: 'x' });
    const body = (await res.json()) as { session: string; user: { id: string; email: string } };
    if (opts.entitled !== false) await setEntitled(body.user.id, true);
    return body;
  };

  /** Directly attach a user to a move with a role (member mgmt is Phase 5). */
  const seedMember = async (moveId: string, userId: string, role: Role) => {
    await db.insert(schema.members).values({ id: `seed_${seedN++}`, moveId, userId, role, createdAt: 1 });
  };

  /** Post an authenticated RevenueCat webhook event. */
  const webhook = (type: string, appUserId: string) =>
    json(
      '/v1/webhooks/revenuecat',
      { event: { type, app_user_id: appUserId } },
      { headers: { authorization: 'Bearer test-secret' } },
    );

  return {
    db,
    kv,
    env,
    setAppleIdentity,
    request,
    json,
    login,
    seedMember,
    setEntitled,
    webhook,
  };
}
