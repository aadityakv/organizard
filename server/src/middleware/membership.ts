// Move-membership middleware for /:id routes: loads the caller's role or returns 403/404.
import { createMiddleware } from 'hono/factory';

import type { Deps } from '../deps';
import { getMembership, type Membership } from '../repos/moves';
import type { UserRow } from '../repos/users';
import type { Env } from '../types';

export type MemberVars = { user: UserRow; member: Membership };

/**
 * Requires the caller to be a member of the `:id` move. 404 (not 403) for
 * non-members so move existence isn't leaked. Sets `c.get('member')`.
 */
export function membershipMiddleware(deps: Deps) {
  return createMiddleware<{ Bindings: Env; Variables: MemberVars }>(async (c, next) => {
    const moveId = c.req.param('id');
    const user = c.get('user');
    if (!moveId) return c.json({ error: 'NOT_FOUND' }, 404);
    const member = await getMembership(deps.getDb(c.env), moveId, user.id);
    if (!member) return c.json({ error: 'NOT_FOUND' }, 404);
    c.set('member', member);
    await next();
  });
}
