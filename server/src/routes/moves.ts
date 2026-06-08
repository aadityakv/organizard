import { ROLE_REQUIRED, type Mutation, type Role } from '@shared/index';
import { Hono } from 'hono';

import type { Deps } from '../deps';
import { authMiddleware } from '../middleware/auth';
import { membershipMiddleware, type MemberVars } from '../middleware/membership';
import { billingEnabled } from '../lib/flags';
import { applyMutations } from '../mutations/apply';
import { createMove, getChangesSince, getMoveSnapshot } from '../repos/moves';
import { createPhotoRecord } from '../repos/photos';
import { boxInMove, itemInMove } from '../repos/scope';
import { changeMemberRole, createInvite, getMoveOwnerId, isOwnerEntitled, removeMember } from '../repos/sharing';
import { isEntitledNow } from '../repos/users';
import type { Env } from '../types';
import { mutationsBodySchema } from '../validation';

export function moveRoutes(deps: Deps) {
  const r = new Hono<{ Bindings: Env; Variables: MemberVars }>();
  r.use('*', authMiddleware(deps));

  // Create a shared move — requires an active subscription ("owner pays to share")
  // only when billing is enabled; otherwise sharing is free.
  r.post('/', async (c) => {
    if (billingEnabled(c.env) && !isEntitledNow(c.get('user'), deps.now())) return c.json({ error: 'ENTITLEMENT_REQUIRED' }, 402);
    type CreateBody = { name?: string; from?: string | null; to?: string | null; targetDate?: string | null; seed?: boolean };
    const body = await c.req.json<CreateBody>().catch(() => ({}) as CreateBody);
    if (!body.name || !body.name.trim()) return c.json({ error: 'INVALID_NAME' }, 400);

    const db = deps.getDb(c.env);
    const moveId = await createMove(db, deps, {
      name: body.name.trim(),
      from: body.from,
      to: body.to,
      targetDate: body.targetDate,
      ownerId: c.get('user').id,
      seed: body.seed,
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
    // Validate shape/types/bounds before anything is applied.
    const parsed = mutationsBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'BAD_MUTATION' }, 400);
    const mutations = parsed.data.mutations as Mutation[];
    const role = c.get('member').role;

    // Enforce role server-side per mutation (client gating is UX only).
    for (const m of mutations) {
      const need = ROLE_REQUIRED[m.type];
      const ok = need === 'owner' ? role === 'owner' : role === 'owner' || role === 'editor';
      if (!ok) return c.json({ error: 'FORBIDDEN_ROLE', type: m.type }, 403);
    }

    // Lapsed owner subscription -> the shared move is read-only (data retained).
    if (billingEnabled(c.env) && !(await isOwnerEntitled(deps.getDb(c.env), c.req.param('id'), deps.now()))) {
      return c.json({ error: 'ENTITLEMENT_REQUIRED' }, 402);
    }

    const res = await applyMutations(deps.getDb(c.env), deps, c.req.param('id'), mutations);
    return c.json(res);
  });

  // --- sharing: invites + member management (owner only) ---
  r.post('/:id/invites', membershipMiddleware(deps), async (c) => {
    if (c.get('member').role !== 'owner') return c.json({ error: 'FORBIDDEN_ROLE' }, 403);
    if (billingEnabled(c.env) && !(await isOwnerEntitled(deps.getDb(c.env), c.req.param('id'), deps.now()))) return c.json({ error: 'ENTITLEMENT_REQUIRED' }, 402);
    const body = await c.req.json<{ role?: Role }>().catch(() => ({}) as { role?: Role });
    const role: Role = body.role ?? 'viewer';
    const invite = await createInvite(deps.getDb(c.env), deps, { moveId: c.req.param('id'), role, createdBy: c.get('user').id });
    return c.json({ ...invite, url: `organizard://invite?token=${invite.token}` });
  });

  r.patch('/:id/members/:userId', membershipMiddleware(deps), async (c) => {
    if (c.get('member').role !== 'owner') return c.json({ error: 'FORBIDDEN_ROLE' }, 403);
    const db = deps.getDb(c.env);
    const moveId = c.req.param('id');
    const userId = c.req.param('userId');
    const body = await c.req.json<{ role?: Role }>().catch(() => ({}) as { role?: Role });
    // Only editor/viewer are assignable; ownership transfer is not a role change.
    if (body.role !== 'editor' && body.role !== 'viewer') return c.json({ error: 'INVALID_ROLE' }, 400);
    if (userId === (await getMoveOwnerId(db, moveId))) return c.json({ error: 'CANNOT_CHANGE_OWNER' }, 400);
    await changeMemberRole(db, { moveId, userId, role: body.role });
    return c.json({ ok: true });
  });

  r.delete('/:id/members/:userId', membershipMiddleware(deps), async (c) => {
    if (c.get('member').role !== 'owner') return c.json({ error: 'FORBIDDEN_ROLE' }, 403);
    const db = deps.getDb(c.env);
    const moveId = c.req.param('id');
    const userId = c.req.param('userId');
    if (userId === (await getMoveOwnerId(db, moveId))) return c.json({ error: 'CANNOT_REMOVE_OWNER' }, 400);
    await removeMember(db, { moveId, userId });
    return c.json({ ok: true });
  });

  // --- photos: reserve a record (bytes uploaded via PUT /v1/photos/:photoId) ---
  r.post('/:id/photos', membershipMiddleware(deps), async (c) => {
    if (c.get('member').role === 'viewer') return c.json({ error: 'FORBIDDEN_ROLE' }, 403);
    const db = deps.getDb(c.env);
    const moveId = c.req.param('id');
    if (billingEnabled(c.env) && !(await isOwnerEntitled(db, moveId, deps.now()))) return c.json({ error: 'ENTITLEMENT_REQUIRED' }, 402);
    const body = await c.req.json<{ itemId?: string; boxId?: string }>().catch(() => ({}) as { itemId?: string; boxId?: string });
    // The linked item/box must belong to this move (no cross-move photo linking).
    if (body.itemId && !(await itemInMove(db, moveId, body.itemId))) return c.json({ error: 'NOT_FOUND' }, 404);
    if (body.boxId && !(await boxInMove(db, moveId, body.boxId))) return c.json({ error: 'NOT_FOUND' }, 404);
    const { photoId } = await createPhotoRecord(db, deps, {
      moveId,
      itemId: body.itemId ?? null,
      boxId: body.boxId ?? null,
      createdBy: c.get('user').id,
    });
    return c.json({ photoId, uploadPath: `/v1/photos/${photoId}` });
  });

  return r;
}
