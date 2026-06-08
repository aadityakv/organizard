import type { Env } from '../types';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days

const key = (token: string) => `session:${token}`;

export async function createSession(env: Env, token: string, userId: string, now: number): Promise<void> {
  await env.SESSIONS.put(key(token), JSON.stringify({ userId, createdAt: now }), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
}

export async function getSessionUserId(env: Env, token: string): Promise<string | null> {
  const raw = await env.SESSIONS.get(key(token));
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { userId: string }).userId ?? null;
  } catch {
    return null;
  }
}

export async function deleteSession(env: Env, token: string): Promise<void> {
  await env.SESSIONS.delete(key(token));
}
