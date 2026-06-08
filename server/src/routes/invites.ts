import { Hono } from 'hono';

import type { Deps } from '../deps';
import { authMiddleware, type AuthVars } from '../middleware/auth';
import { getMoveSnapshot } from '../repos/moves';
import { acceptInvite } from '../repos/sharing';
import type { Env } from '../types';

// Accepting an invite needs auth but NOT membership (the user isn't a member yet).
export function inviteRoutes(deps: Deps) {
  const r = new Hono<{ Bindings: Env; Variables: AuthVars }>();
  r.use('*', authMiddleware(deps));

  r.post('/:token/accept', async (c) => {
    const db = deps.getDb(c.env);
    const result = await acceptInvite(db, deps, { token: c.req.param('token'), userId: c.get('user').id });
    if ('error' in result) return c.json({ error: result.error }, 400);
    return c.json(await getMoveSnapshot(db, result.moveId));
  });

  return r;
}
