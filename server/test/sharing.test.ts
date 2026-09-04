import type { Mutation } from '@shared/index';
import { describe, expect, it } from 'vitest';

import { makeHarness } from './helpers/harness';

const auth = (session: string) => ({ headers: { Authorization: `Bearer ${session}` } });
const m = (type: string, payload: unknown, clientId: string): Mutation =>
  ({ type, clientId, ts: 1, payload }) as unknown as Mutation;

async function ownerWithMove(h: Awaited<ReturnType<typeof makeHarness>>) {
  const owner = await h.login('owner', 'o@x.com');
  const snap = (await (await h.json('/v1/moves', { name: 'NYC' }, auth(owner.session))).json()) as {
    move: { id: string };
  };
  return { owner, moveId: snap.move.id };
}

async function invite(
  h: Awaited<ReturnType<typeof makeHarness>>,
  session: string,
  moveId: string,
  role: string,
) {
  const res = await h.json(`/v1/moves/${moveId}/invites`, { role }, auth(session));
  return { status: res.status, body: (await res.json()) as { token: string; role: string } };
}

describe('sharing — invite + accept', () => {
  it('an invited user joins with the invited role and can access the move', async () => {
    const h = await makeHarness();
    const { owner, moveId } = await ownerWithMove(h);

    const inv = await invite(h, owner.session, moveId, 'editor');
    expect(inv.status).toBe(200);
    expect(inv.body.role).toBe('editor');

    const jo = await h.login('jo', 'jo@x.com');
    const accept = await h.json(`/v1/invites/${inv.body.token}/accept`, {}, auth(jo.session));
    expect(accept.status).toBe(200);
    const snap = (await accept.json()) as { members: { userId: string; role: string }[] };
    expect(snap.members).toHaveLength(2);
    expect(snap.members.find((mem) => mem.userId === jo.user.id)?.role).toBe('editor');

    // jo can now read the move and edit (editor)
    expect((await h.request(`/v1/moves/${moveId}`, auth(jo.session))).status).toBe(200);
    const edit = await h.json(
      `/v1/moves/${moveId}/mutations`,
      { mutations: [m('addRoom', { id: 'r1', name: 'Den', icon: 'sofa' }, 'c1')] },
      auth(jo.session),
    );
    expect(edit.status).toBe(200);
  });

  it('rejects an invalid token and a reused token', async () => {
    const h = await makeHarness();
    const { owner, moveId } = await ownerWithMove(h);
    const inv = await invite(h, owner.session, moveId, 'viewer');
    const jo = await h.login('jo', 'jo@x.com');

    expect((await h.json('/v1/invites/nope/accept', {}, auth(jo.session))).status).toBe(400);

    expect((await h.json(`/v1/invites/${inv.body.token}/accept`, {}, auth(jo.session))).status).toBe(200);
    const second = await h.json(`/v1/invites/${inv.body.token}/accept`, {}, auth(jo.session));
    expect(second.status).toBe(400); // INVITE_USED
  });

  it('non-owner cannot create an invite', async () => {
    const h = await makeHarness();
    const { owner, moveId } = await ownerWithMove(h);
    const inv = await invite(h, owner.session, moveId, 'editor');
    const ed = await h.login('ed', 'ed@x.com');
    await h.json(`/v1/invites/${inv.body.token}/accept`, {}, auth(ed.session));

    const res = await invite(h, ed.session, moveId, 'viewer');
    expect(res.status).toBe(403);
  });

  // Ownership is never transferable via invite — an owner-role member could
  // otherwise hard-delete the move and mint more owners.
  it('rejects an invite at role owner (only editor/viewer are grantable)', async () => {
    const h = await makeHarness();
    const { owner, moveId } = await ownerWithMove(h);
    const res = await invite(h, owner.session, moveId, 'owner');
    expect(res.status).toBe(400);
    expect((res.body as unknown as { error?: string }).error).toBe('INVALID_ROLE');
  });
});

describe('sharing — member management (owner only)', () => {
  it('owner changes a role and removes a member; owner is protected', async () => {
    const h = await makeHarness();
    const { owner, moveId } = await ownerWithMove(h);
    const inv = await invite(h, owner.session, moveId, 'viewer');
    const v = await h.login('v', 'v@x.com');
    await h.json(`/v1/invites/${inv.body.token}/accept`, {}, auth(v.session));

    // viewer can't edit yet
    expect(
      (
        await h.json(
          `/v1/moves/${moveId}/mutations`,
          { mutations: [m('addRoom', { id: 'r1', name: 'X', icon: 'box' }, 'c1')] },
          auth(v.session),
        )
      ).status,
    ).toBe(403);

    const patch = await h.request(`/v1/moves/${moveId}/members/${v.user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'editor' }),
      headers: { 'content-type': 'application/json', ...auth(owner.session).headers },
    });
    expect(patch.status).toBe(200);
    expect(
      (
        await h.json(
          `/v1/moves/${moveId}/mutations`,
          { mutations: [m('addRoom', { id: 'r2', name: 'Y', icon: 'box' }, 'c2')] },
          auth(v.session),
        )
      ).status,
    ).toBe(200);

    const protectOwner = await h.request(`/v1/moves/${moveId}/members/${owner.user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'viewer' }),
      headers: { 'content-type': 'application/json', ...auth(owner.session).headers },
    });
    expect(protectOwner.status).toBe(400);

    const del = await h.request(`/v1/moves/${moveId}/members/${v.user.id}`, {
      method: 'DELETE',
      headers: auth(owner.session).headers,
    });
    expect(del.status).toBe(200);
    expect((await h.request(`/v1/moves/${moveId}`, auth(v.session))).status).toBe(404);
  });

  // A silent ok:true for a non-member target would hide typos and stale UI.
  it('role-change and removal of a non-member 404 instead of ok', async () => {
    const h = await makeHarness();
    const { owner, moveId } = await ownerWithMove(h);
    const stranger = await h.login('stranger', 's@x.com');

    const patch = await h.request(`/v1/moves/${moveId}/members/${stranger.user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'editor' }),
      headers: { 'content-type': 'application/json', ...auth(owner.session).headers },
    });
    expect(patch.status).toBe(404);

    const del = await h.request(`/v1/moves/${moveId}/members/${stranger.user.id}`, {
      method: 'DELETE',
      headers: auth(owner.session).headers,
    });
    expect(del.status).toBe(404);
  });
});
