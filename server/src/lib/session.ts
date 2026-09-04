// Session tokens in KV. A token maps to a user id with a TTL; per-user index lets
// "sign out everywhere" and account deletion revoke every session at once.
import type { Env } from '../types';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days

const sessKey = (token: string) => `session:${token}`;
// Per-user index so all of a user's sessions can be revoked at once.
const indexKey = (userId: string, token: string) => `usess:${userId}:${token}`;

/** Store a session token → user id mapping in KV. */
export async function createSession(env: Env, token: string, userId: string, now: number): Promise<void> {
  await env.SESSIONS.put(sessKey(token), JSON.stringify({ userId, createdAt: now }), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  await env.SESSIONS.put(indexKey(userId, token), '1', { expirationTtl: SESSION_TTL_SECONDS });
}

/** Resolve a session token to its user id, or null. */
export async function getSessionUserId(env: Env, token: string): Promise<string | null> {
  const raw = await env.SESSIONS.get(sessKey(token));
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { userId: string }).userId ?? null;
  } catch {
    return null;
  }
}

/** Revoke one session token. */
export async function deleteSession(env: Env, token: string): Promise<void> {
  const userId = await getSessionUserId(env, token);
  await env.SESSIONS.delete(sessKey(token));
  if (userId) await env.SESSIONS.delete(indexKey(userId, token));
}

/** Revoke every session for a user ("sign out everywhere"). */
export async function deleteAllSessions(env: Env, userId: string): Promise<void> {
  const prefix = `usess:${userId}:`;
  let cursor: string | undefined;
  do {
    const res = await env.SESSIONS.list({ prefix, cursor });
    for (const k of res.keys) {
      const token = k.name.slice(prefix.length);
      await env.SESSIONS.delete(sessKey(token));
      await env.SESSIONS.delete(k.name);
    }
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
}
