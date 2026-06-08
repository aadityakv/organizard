import type { Role } from '@shared/index';

import { createApp } from '../../src/app';
import * as schema from '../../src/db/schema';
import type { AppleIdentity } from '../../src/lib/apple';
import type { Env } from '../../src/types';
import { makeTestDb } from './db';
import { makeMemoryKv } from './kv';

/** A wired app with in-memory DB/KV and stubbed Apple/email/time/ids. */
export async function makeHarness(opts: { now?: number } = {}) {
  const db = await makeTestDb();
  const kv = makeMemoryKv();
  const sentEmails: { to: string; link: string }[] = [];
  let appleNext: AppleIdentity | null = null; // null => verify throws

  let idN = 0;
  let tokN = 0;
  let seedN = 0;

  const env = {
    DB: undefined as unknown as D1Database,
    PHOTOS: undefined as unknown as R2Bucket,
    SESSIONS: kv,
    APP_URL: 'organizard://auth',
  } satisfies Env;

  const app = createApp({
    getDb: () => db,
    now: () => opts.now ?? 1_700_000_000_000,
    newId: () => `id_${idN++}`,
    newToken: () => `tok_${tokN++}`,
    verifyApple: async () => {
      if (!appleNext) throw new Error('invalid apple token');
      return appleNext;
    },
    sendEmail: async (_env, to, link) => {
      sentEmails.push({ to, link });
    },
  });

  const setAppleIdentity = (id: AppleIdentity) => {
    appleNext = id;
  };
  const request = (path: string, init?: RequestInit) => app.request(path, init, env);
  const json = (path: string, body: unknown, init: RequestInit = {}) =>
    app.request(
      path,
      { method: 'POST', ...init, body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } },
      env,
    );

  /** Sign in via Apple and return the session + user. */
  const login = async (sub: string, email: string) => {
    setAppleIdentity({ sub, email });
    const res = await json('/v1/auth/apple', { identityToken: 'x' });
    return (await res.json()) as { session: string; user: { id: string; email: string } };
  };

  /** Directly attach a user to a move with a role (member mgmt is Phase 5). */
  const seedMember = async (moveId: string, userId: string, role: Role) => {
    await db.insert(schema.members).values({ id: `seed_${seedN++}`, moveId, userId, role, createdAt: 1 });
  };

  return { db, kv, env, sentEmails, setAppleIdentity, request, json, login, seedMember };
}
