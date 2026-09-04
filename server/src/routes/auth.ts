// /v1/auth: Sign in with Apple, email/password register + login, legacy magic-link
// verify, logout (one or all sessions) and account deletion. Sign-in endpoints are
// rate-limited per address and per IP and never reveal whether an email exists.
import { Hono } from 'hono';

import type { Deps } from '../deps';
import { authMiddleware, type AuthVars } from '../middleware/auth';
import { hashPassword, verifyPassword } from '../lib/password';
import { rateLimit } from '../lib/ratelimit';
import { createSession, deleteAllSessions, deleteSession } from '../lib/session';
import {
  createPasswordUser,
  deleteUserAndData,
  getUserByEmail,
  toPublicUser,
  upsertAppleUser,
  upsertEmailUser,
} from '../repos/users';
import type { Env } from '../types';
import { appleLoginBody, emailStartBody, loginBody, parseBody, registerBody } from '../validation';

const MAGIC_TTL_SECONDS = 60 * 15; // 15 minutes
const magicKey = (token: string) => `maglink:${token}`;

/** Sign-in, sign-out and account-deletion routes. */
export function authRoutes(deps: Deps) {
  const r = new Hono<{ Bindings: Env; Variables: AuthVars }>();

  r.post('/apple', async (c) => {
    const body = await parseBody(c, appleLoginBody);
    if (!body.ok) return c.json({ error: 'MISSING_TOKEN' }, 400);
    const { identityToken } = body.data;

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
    const body = await parseBody(c, emailStartBody);
    if (!body.ok) return c.json({ error: 'INVALID_EMAIL' }, 400);
    const normalized = body.data.email;

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

  r.post('/email/register', async (c) => {
    const body = await parseBody(c, registerBody);
    if (!body.ok)
      return c.json({ error: body.field === 'password' ? 'WEAK_PASSWORD' : 'INVALID_EMAIL' }, 400);
    const { email: normalized, password } = body.data;

    // Curb automated signup abuse (per IP, hourly).
    const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
    if (!(await rateLimit(c.env.SESSIONS, `reg:${ip}`, 10, 3600)))
      return c.json({ error: 'RATE_LIMITED' }, 429);

    const db = deps.getDb(c.env);
    if (await getUserByEmail(db, normalized)) return c.json({ error: 'EMAIL_TAKEN' }, 409);

    const user = await createPasswordUser(db, {
      email: normalized,
      passwordHash: await hashPassword(password),
      id: deps.newId(),
      now: deps.now(),
    });
    const session = deps.newToken();
    await createSession(c.env, session, user.id, deps.now());
    return c.json({ session, user: toPublicUser(user) });
  });

  // Email + password — sign in. Generic 401 so we don't reveal which part was wrong.
  r.post('/email/login', async (c) => {
    // A malformed body gets the same generic 401 as a wrong password: nothing about
    // the request shape may reveal whether an account exists.
    const body = await parseBody(c, loginBody);
    if (!body.ok) return c.json({ error: 'INVALID_CREDENTIALS' }, 401);
    const { email: normalized, password } = body.data;

    // Throttle brute-force (per address + per IP, 15-min window).
    const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
    const okEmail = await rateLimit(c.env.SESSIONS, `login:${normalized}`, 10, 900);
    const okIp = await rateLimit(c.env.SESSIONS, `loginip:${ip}`, 50, 900);
    if (!okEmail || !okIp) return c.json({ error: 'RATE_LIMITED' }, 429);

    const db = deps.getDb(c.env);
    const user = await getUserByEmail(db, normalized);
    if (!user || !(await verifyPassword(password, user.passwordHash)))
      return c.json({ error: 'INVALID_CREDENTIALS' }, 401);

    const session = deps.newToken();
    await createSession(c.env, session, user.id, deps.now());
    return c.json({ session, user: toPublicUser(user) });
  });

  // Delete account (App Store 5.1.1(v)) — removes the user, their owned moves and
  // data, their memberships, and revokes every session.
  r.delete('/account', authMiddleware(deps), async (c) => {
    const userId = c.get('user').id;
    await deleteUserAndData(deps.getDb(c.env), userId);
    await deleteAllSessions(c.env, userId);
    return c.json({ ok: true });
  });

  r.post('/logout', authMiddleware(deps), async (c) => {
    const header = c.req.header('Authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (token) await deleteSession(c.env, token);
    return c.json({ ok: true });
  });

  r.post('/logout-all', authMiddleware(deps), async (c) => {
    await deleteAllSessions(c.env, c.get('user').id);
    return c.json({ ok: true });
  });

  return r;
}
