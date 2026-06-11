import { Hono } from 'hono';

import type { Deps } from '../deps';
import { authMiddleware, type AuthVars } from '../middleware/auth';
import { rateLimit } from '../lib/ratelimit';
import { createSession, deleteAllSessions, deleteSession } from '../lib/session';
import { toPublicUser, upsertAppleUser, upsertEmailUser } from '../repos/users';
import type { Env } from '../types';

const MAGIC_TTL_SECONDS = 60 * 15; // 15 minutes
const magicKey = (token: string) => `maglink:${token}`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function authRoutes(deps: Deps) {
  const r = new Hono<{ Bindings: Env; Variables: AuthVars }>();

  // Sign in with Apple — verify the identity token, find-or-create the user.
  r.post('/apple', async (c) => {
    const { identityToken } = await c.req.json<{ identityToken?: string }>().catch(() => ({ identityToken: undefined }));
    if (!identityToken) return c.json({ error: 'MISSING_TOKEN' }, 400);

    let identity;
    try {
      identity = await deps.verifyApple(identityToken, c.env.APPLE_BUNDLE_ID);
    } catch {
      return c.json({ error: 'INVALID_TOKEN' }, 401);
    }

    const db = deps.getDb(c.env);
    const user = await upsertAppleUser(db, {
      sub: identity.sub,
      email: identity.email,
      id: deps.newId(),
      now: deps.now(),
    });

    const session = deps.newToken();
    await createSession(c.env, session, user.id, deps.now());
    return c.json({ session, user: toPublicUser(user) });
  });

  // Email magic link — step 1: send the link. Never reveal whether the email exists.
  r.post('/email/start', async (c) => {
    const { email } = await c.req.json<{ email?: string }>().catch(() => ({ email: undefined }));
    const normalized = email?.trim().toLowerCase();
    if (!normalized || !EMAIL_RE.test(normalized)) return c.json({ error: 'INVALID_EMAIL' }, 400);

    // Throttle to curb abuse / email-relay spam (per address + per IP, 15-min window).
    const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
    const okEmail = await rateLimit(c.env.SESSIONS, `mail:${normalized}`, 5, 900);
    const okIp = await rateLimit(c.env.SESSIONS, `mailip:${ip}`, 20, 900);
    if (!okEmail || !okIp) return c.json({ error: 'RATE_LIMITED' }, 429);

    const token = deps.newToken();
    await c.env.SESSIONS.put(magicKey(token), JSON.stringify({ email: normalized }), {
      expirationTtl: MAGIC_TTL_SECONDS,
    });

    const base = c.env.APP_URL ?? 'tuck://auth';
    await deps.sendEmail(c.env, normalized, `${base}?token=${token}`);
    return c.json({ ok: true });
  });

  // Email magic link — step 2: verify the token (single-use), sign in.
  r.get('/email/verify', async (c) => {
    const token = c.req.query('token');
    if (!token) return c.json({ error: 'INVALID_TOKEN' }, 400);

    const raw = await c.env.SESSIONS.get(magicKey(token));
    if (!raw) return c.json({ error: 'INVALID_TOKEN' }, 400);
    await c.env.SESSIONS.delete(magicKey(token)); // single use (best-effort; KV get-then-delete)

    const { email } = JSON.parse(raw) as { email: string };
    const db = deps.getDb(c.env);
    const user = await upsertEmailUser(db, { email, id: deps.newId(), now: deps.now() });

    const session = deps.newToken();
    await createSession(c.env, session, user.id, deps.now());
    return c.json({ session, user: toPublicUser(user) });
  });

  // Sign out — revoke the current session.
  r.post('/logout', authMiddleware(deps), async (c) => {
    const header = c.req.header('Authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (token) await deleteSession(c.env, token);
    return c.json({ ok: true });
  });

  // Sign out everywhere — revoke all of the user's sessions.
  r.post('/logout-all', authMiddleware(deps), async (c) => {
    await deleteAllSessions(c.env, c.get('user').id);
    return c.json({ ok: true });
  });

  return r;
}
