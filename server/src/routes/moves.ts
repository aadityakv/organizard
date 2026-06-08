import { ROLE_REQUIRED, type Mutation } from '@shared/index';
import { Hono } from 'hono';

import type { Deps } from '../deps';
import { authMiddleware } from '../middleware/auth';
import { membershipMiddleware, type MemberVars } from '../middleware/membership';
import { applyMutations } from '../mutations/apply';
import { createMove, getChangesSince, getMoveSnapshot } from '../repos/moves';
import type { Env } from '../types';

export function moveRoutes(deps: Deps) {
  const r = new Hono<{ Bindings: Env; Variables: MemberVars }>();
  r.use('*', authMiddleware(deps));

  // Create a shared move. (Entitlement gate is added in Phase 7.)
  r.post('/', async (c) => {
    type CreateBody = { name?: string; from?: string | null; to?: string | null; targetDate?: string | null };
    const body = await c.req.json<CreateBody>().catch(() => ({}) as CreateBody);
    if (!body.name || !body.name.trim()) return c.json({ error: 'INVALID_NAME' }, 400);

    const db = deps.getDb(c.env);
    const moveId = await createMove(db, deps, {
      name: body.name.trim(),
      from: body.from,
      to: body.to,
      targetDate: body.targetDate,
      ownerId: c.get('user').id,
    });
    return c.json(await getMoveSnapshot(db, moveId), 201);
  });

  r.get('/:id', membershipMiddleware(deps), async (c) => {
    const snap = await getMoveSnapshot(deps.getDb(c.env), c.req.param('id'));
    if (!snap) return c.json({ error: 'NOT_FOUND' }, 404);
    return c.json(snap);
  });

  r.get('/:id/changes', membershipMiddleware(deps), async (c) => {
    const since = Number(c.req.query('since') ?? '0') || 0;
    const changes = await getChangesSince(deps.getDb(c.env), deps, c.req.param('id'), since);
    return c.json(changes);
  });

  r.post('/:id/mutations', membershipMiddleware(deps), async (c) => {
    const body = await c.req.json<{ mutations?: Mutation[] }>().catch(() => ({ mutations: [] as Mutation[] }));
    const mutations = body.mutations ?? [];
    const role = c.get('member').role;

    // Enforce role server-side per mutation (client gating is UX only).
    for (const m of mutations) {
      const need = ROLE_REQUIRED[m.type];
      const ok = need === 'owner' ? role === 'owner' : role === 'owner' || role === 'editor';
      if (!ok) return c.json({ error: 'FORBIDDEN_ROLE', type: m.type }, 403);
    }

    const res = await applyMutations(deps.getDb(c.env), deps, c.req.param('id'), mutations);
    return c.json(res);
  });

  return r;
}
