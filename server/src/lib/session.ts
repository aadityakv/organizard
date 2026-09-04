// Session tokens in KV. A token maps to a user id with a TTL; per-user index lets
// "sign out everywhere" and account deletion revoke every session at once.
import type { Env } from '../types';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days
/** A session used at least this long after it was (re)issued gets a fresh 60-day window. */
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

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

/**
 * Resolve a session token to its user id, or null. Sessions slide: one that has been
 * in use for over a week since issue is re-issued with a fresh TTL, so an active
 * device is never signed out for age alone.
 */
export async function getSessionUserId(
  env: Env,
  token: string,
  now: number = Date.now(),
): Promise<string | null> {
  const raw = await env.SESSIONS.get(sessKey(token));
  if (!raw) return null;
  let parsed: { userId?: string; createdAt?: number };
  try {
    parsed = JSON.parse(raw) as { userId?: string; createdAt?: number };
  } catch {
    return null;
  }
  if (!parsed.userId) return null;
  if (now - (parsed.createdAt ?? 0) > REFRESH_AFTER_MS) await createSession(env, token, parsed.userId, now);
  return parsed.userId;
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
