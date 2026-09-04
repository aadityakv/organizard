// /v1/moves: create a move, fetch its snapshot or changes, apply a mutation batch,
// delete it, manage members and invites, and reserve photo records. Everything under
// /:id runs behind the membership middleware.
import { ROLE_REQUIRED, type Mutation, type Role } from '@shared/index';
import { Hono } from 'hono';

import type { Deps } from '../deps';
import { authMiddleware } from '../middleware/auth';
import { membershipMiddleware, type MemberVars } from '../middleware/membership';
import { billingEnabled, ownerEntitledOrResponse } from '../lib/flags';
import { applyMutations } from '../mutations/apply';
import { createMove, deleteMove, getChangesSince, getMembership, getMoveSnapshot } from '../repos/moves';
import { createPhotoRecord } from '../repos/photos';
import { boxInMove, itemInMove } from '../repos/scope';
import { changeMemberRole, createInvite, getMoveOwnerId, removeMember } from '../repos/sharing';
import { isEntitledNow } from '../repos/users';
import type { Env } from '../types';
import {
  createMoveBody,
  inviteBody,
  memberRoleBody,
  mutationsBodySchema,
  parseBody,
  photoLinkBody,
} from '../validation';
import { ROLES } from '@shared/index';

/** Error code for an invalid createMove body, by offending field. */
const CREATE_FIELD_CODE: Record<string, string> = {
  name: 'INVALID_NAME',
  from: 'INVALID_ADDRESS',
  to: 'INVALID_ADDRESS',
  targetDate: 'INVALID_DATE',
};

/** Move routes: create, snapshot, changes, mutations, members, invites and photos. */
export function moveRoutes(deps: Deps) {
  const r = new Hono<{ Bindings: Env; Variables: MemberVars }>();
  r.use('*', authMiddleware(deps));

  // Create a shared move — requires an active subscription ("owner pays to share")
  // only when billing is enabled; otherwise sharing is free.
  r.post('/', async (c) => {
    if (billingEnabled(c.env) && !isEntitledNow(c.get('user'), deps.now()))
      return c.json({ error: 'ENTITLEMENT_REQUIRED' }, 402);
    const parsed = await parseBody(c, createMoveBody);
    if (!parsed.ok)
      return c.json({ error: CREATE_FIELD_CODE[parsed.field ?? 'name'] ?? 'INVALID_NAME' }, 400);
    const body = parsed.data;

    const db = deps.getDb(c.env);
    const moveId = await createMove(db, deps, {
      name: body.name,
      from: body.from,
      to: body.to,
      targetDate: body.targetDate,
      ownerId: c.get('user').id,
      seed: body.seed,
      clientId: body.clientId,
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
    const parsed = await parseBody(c, mutationsBodySchema);
    if (!parsed.ok) return c.json({ error: 'BAD_MUTATION' }, 400);
    const mutations = parsed.data.mutations as Mutation[];
    const role = c.get('member').role;

    // Enforce role server-side per mutation (client gating is UX only).
    for (const m of mutations) {
      const need = ROLE_REQUIRED[m.type];
      const ok = need === ROLES.owner ? role === ROLES.owner : role === ROLES.owner || role === ROLES.editor;
      if (!ok) return c.json({ error: 'FORBIDDEN_ROLE', type: m.type }, 403);
    }

    // Lapsed owner subscription -> the shared move is read-only (data retained).
    const entitled = await ownerEntitledOrResponse(deps, c, c.req.param('id'));
    if (entitled) return entitled;

    const res = await applyMutations(deps.getDb(c.env), deps, c.req.param('id'), mutations);
    return c.json(res);
  });

  // Owner-only: hard-delete the move and all its data (DB rows and R2 photo blobs).
  // membershipMiddleware returns 404 for non-members so move existence isn't leaked.
  r.delete('/:id', membershipMiddleware(deps), async (c) => {
    if (c.get('member').role !== ROLES.owner) return c.json({ error: 'FORBIDDEN_ROLE' }, 403);
    const moveId = c.req.param('id');
    await deleteMove(deps.getDb(c.env), moveId, (keys) => c.env.PHOTOS.delete(keys));
    return c.json({ ok: true });
  });

  r.post('/:id/invites', membershipMiddleware(deps), async (c) => {
    if (c.get('member').role !== ROLES.owner) return c.json({ error: 'FORBIDDEN_ROLE' }, 403);
    const entitled = await ownerEntitledOrResponse(deps, c, c.req.param('id'));
    if (entitled) return entitled;
    const body = await parseBody(c, inviteBody);
    if (!body.ok) return c.json({ error: 'INVALID_ROLE' }, 400);
    const role: Role = body.data.role;
    const invite = await createInvite(deps.getDb(c.env), deps, {
      moveId: c.req.param('id'),
      role,
      createdBy: c.get('user').id,
    });
    return c.json({ ...invite, url: `tuck://invite?token=${invite.token}` });
  });

  r.patch('/:id/members/:userId', membershipMiddleware(deps), async (c) => {
    if (c.get('member').role !== ROLES.owner) return c.json({ error: 'FORBIDDEN_ROLE' }, 403);
    const db = deps.getDb(c.env);
    const moveId = c.req.param('id');
    const userId = c.req.param('userId');
    const body = await parseBody(c, memberRoleBody);
    if (!body.ok) return c.json({ error: 'INVALID_ROLE' }, 400);
    if (userId === (await getMoveOwnerId(db, moveId))) return c.json({ error: 'CANNOT_CHANGE_OWNER' }, 400);
    // 404 when the target isn't a member (a silent ok would hide typos/staleness).
    if (!(await getMembership(db, moveId, userId))) return c.json({ error: 'NOT_FOUND' }, 404);
    await changeMemberRole(db, { moveId, userId, role: body.data.role });
    return c.json({ ok: true });
  });

  r.delete('/:id/members/:userId', membershipMiddleware(deps), async (c) => {
    if (c.get('member').role !== ROLES.owner) return c.json({ error: 'FORBIDDEN_ROLE' }, 403);
    const db = deps.getDb(c.env);
    const moveId = c.req.param('id');
    const userId = c.req.param('userId');
    if (userId === (await getMoveOwnerId(db, moveId))) return c.json({ error: 'CANNOT_REMOVE_OWNER' }, 400);
    if (!(await getMembership(db, moveId, userId))) return c.json({ error: 'NOT_FOUND' }, 404);
    await removeMember(db, { moveId, userId });
    return c.json({ ok: true });
  });

  r.post('/:id/photos', membershipMiddleware(deps), async (c) => {
    if (c.get('member').role === ROLES.viewer) return c.json({ error: 'FORBIDDEN_ROLE' }, 403);
    const db = deps.getDb(c.env);
    const moveId = c.req.param('id');
    const entitled = await ownerEntitledOrResponse(deps, c, moveId);
    if (entitled) return entitled;
    const parsed = await parseBody(c, photoLinkBody);
    if (!parsed.ok) return c.json({ error: 'INVALID_BODY' }, 400);
    const body = parsed.data;
    // The linked item/box must belong to this move (no cross-move photo linking).
    if (body.itemId && !(await itemInMove(db, moveId, body.itemId)))
      return c.json({ error: 'NOT_FOUND' }, 404);
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
