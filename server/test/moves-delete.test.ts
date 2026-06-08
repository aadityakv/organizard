import { describe, expect, it } from 'vitest';

import { makeHarness } from './helpers/harness';

const auth = (s: string) => ({ headers: { Authorization: `Bearer ${s}` } });

async function ownerWithMove(h: Awaited<ReturnType<typeof makeHarness>>) {
  const owner = await h.login('owner', 'o@x.com');
  const snap = (await (await h.json('/v1/moves', { name: 'NYC' }, auth(owner.session))).json()) as { move: { id: string } };
  return { owner, moveId: snap.move.id };
}

describe('DELETE /v1/moves/:id', () => {
  it('owner deletes the move and it is gone', async () => {
    const h = await makeHarness();
    const { owner, moveId } = await ownerWithMove(h);
    const del = await h.request(`/v1/moves/${moveId}`, { method: 'DELETE', ...auth(owner.session) });
    expect(del.status).toBe(200);
    expect((await h.request(`/v1/moves/${moveId}`, auth(owner.session))).status).toBe(404);
  });

  it('an editor cannot delete (403)', async () => {
    const h = await makeHarness();
    const { owner, moveId } = await ownerWithMove(h);
    const inv = (await (await h.json(`/v1/moves/${moveId}/invites`, { role: 'editor' }, auth(owner.session))).json()) as { token: string };
    const jo = await h.login('jo', 'jo@x.com');
    await h.json(`/v1/invites/${inv.token}/accept`, {}, auth(jo.session));
    const del = await h.request(`/v1/moves/${moveId}`, { method: 'DELETE', ...auth(jo.session) });
    expect(del.status).toBe(403);
  });

  it('a non-member gets 404 (existence not leaked)', async () => {
    const h = await makeHarness();
    const { moveId } = await ownerWithMove(h);
    const stranger = await h.login('x', 'x@x.com');
    const del = await h.request(`/v1/moves/${moveId}`, { method: 'DELETE', ...auth(stranger.session) });
    expect(del.status).toBe(404);
  });
});
