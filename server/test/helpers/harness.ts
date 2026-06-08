import { createApp } from '../../src/app';
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

  return {
    db,
    kv,
    env,
    sentEmails,
    setAppleIdentity(id: AppleIdentity) {
      appleNext = id;
    },
    request: (path: string, init?: RequestInit) => app.request(path, init, env),
    json: (path: string, body: unknown, init: RequestInit = {}) =>
      app.request(
        path,
        { method: 'POST', ...init, body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } },
        env,
      ),
  };
}
