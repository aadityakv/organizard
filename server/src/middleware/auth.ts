// Bearer-session middleware. Resolves the Authorization token to a user row and
// puts it on the context; missing or unknown tokens get a 401.
import { createMiddleware } from 'hono/factory';

import type { Deps } from '../deps';
import { getSessionUserId } from '../lib/session';
import { getUserById, type UserRow } from '../repos/users';
import type { Env } from '../types';

export type AuthVars = { user: UserRow };

/** Resolves the Bearer session → user, or 401s. Sets `c.get('user')`. */
export function authMiddleware(deps: Deps) {
  return createMiddleware<{ Bindings: Env; Variables: AuthVars }>(async (c, next) => {
    const header = c.req.header('Authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) return c.json({ error: 'UNAUTHENTICATED' }, 401);

    const userId = await getSessionUserId(c.env, token, deps.now());
    if (!userId) return c.json({ error: 'UNAUTHENTICATED' }, 401);

    const user = await getUserById(deps.getDb(c.env), userId);
    if (!user) return c.json({ error: 'UNAUTHENTICATED' }, 401);

    c.set('user', user);
    await next();
  });
}
