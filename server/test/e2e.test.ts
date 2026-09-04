import type { Mutation } from '@shared/index';
import { describe, expect, it } from 'vitest';

import { makeHarness } from './helpers/harness';

const auth = (s: string) => ({ headers: { Authorization: `Bearer ${s}` } });
const m = (type: string, payload: unknown, clientId: string): Mutation =>
  ({ type, clientId, ts: 1, payload }) as unknown as Mutation;

describe('e2e — subscribe → share → collaborate → lapse → renew', () => {
  it('runs the whole flow', async () => {
    const h = await makeHarness();

    // owner (subscribed) creates a shared move
    const owner = await h.login('owner', 'o@x.com');
    const snap0 = (await (await h.json('/v1/moves', { name: 'NYC' }, auth(owner.session))).json()) as {
      move: { id: string };
      statuses: { id: string }[];
    };
    const moveId = snap0.move.id;
    const statusId = snap0.statuses[0].id;

    const inv = (await (
      await h.json(`/v1/moves/${moveId}/invites`, { role: 'editor' }, auth(owner.session))
    ).json()) as { token: string };
    const ed = await h.login('ed', 'ed@x.com');
    expect((await h.json(`/v1/invites/${inv.token}/accept`, {}, auth(ed.session))).status).toBe(200);

    expect(
      (
        await h.json(
          `/v1/moves/${moveId}/mutations`,
          {
            mutations: [
              m('addRoom', { id: 'r0', name: 'Kitchen', icon: 'cooking-pot' }, 'c0'),
              m(
                'addBox',
                { id: 'b1', roomId: 'r0', number: 1, name: 'Kitchen', color: 'amber', statusId },
                'c1',
              ),
              m('addItem', { id: 'i1', boxId: 'b1', name: 'Skillet', qty: 1, valueCents: 8000 }, 'c2'),
            ],
          },
          auth(ed.session),
        )
      ).status,
    ).toBe(200);

    // owner pulls the delta and sees the editor's work + both members
    const changes = (await (
      await h.request(`/v1/moves/${moveId}/changes?since=0`, auth(owner.session))
    ).json()) as {
      boxes: { id: string }[];
      items: { id: string }[];
      members: unknown[];
    };
    expect(changes.boxes.map((b) => b.id)).toContain('b1');
    expect(changes.items.map((i) => i.id)).toContain('i1');
    expect(changes.members).toHaveLength(2);

    // owner's subscription lapses -> the shared move goes read-only
    await h.webhook('EXPIRATION', owner.user.id);
    expect(
      (
        await h.json(
          `/v1/moves/${moveId}/mutations`,
          { mutations: [m('addRoom', { id: 'r9', name: 'No', icon: 'box' }, 'c3')] },
          auth(ed.session),
        )
      ).status,
    ).toBe(402);
    // read-only also blocks the photo + invite write paths
    expect((await h.json(`/v1/moves/${moveId}/photos`, { itemId: 'i1' }, auth(ed.session))).status).toBe(402);
    expect(
      (await h.json(`/v1/moves/${moveId}/invites`, { role: 'viewer' }, auth(owner.session))).status,
    ).toBe(402);
    expect((await h.request(`/v1/moves/${moveId}`, auth(ed.session))).status).toBe(200); // reading still works

    // renew -> editing restored
    await h.webhook('RENEWAL', owner.user.id);
    expect(
      (
        await h.json(
          `/v1/moves/${moveId}/mutations`,
          { mutations: [m('addRoom', { id: 'r9', name: 'Yes', icon: 'box' }, 'c4')] },
          auth(ed.session),
        )
      ).status,
    ).toBe(200);
  });
});
