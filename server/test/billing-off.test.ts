import type { Mutation } from '@shared/index';
import { describe, expect, it } from 'vitest';

import { makeHarness } from './helpers/harness';

const auth = (s: string) => ({ headers: { Authorization: `Bearer ${s}` } });
const m = (type: string, payload: unknown, clientId: string): Mutation =>
  ({ type, clientId, ts: 1, payload }) as unknown as Mutation;

describe('billing off (default) — sharing is free, no subscription required', () => {
  it('an unentitled owner can create, share, mutate, and add photos', async () => {
    const h = await makeHarness({ billing: false });

    // Owner has NO entitlement, yet can create a shared move.
    const owner = await h.login('owner', 'o@x.com', { entitled: false });
    const create = await h.json('/v1/moves', { name: 'NYC' }, auth(owner.session));
    expect(create.status).toBe(201);
    const snap = (await create.json()) as { move: { id: string }; statuses: { id: string }[] };
    const moveId = snap.move.id;
    const statusId = snap.statuses[0].id;

    // Mutations are accepted without entitlement.
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
          auth(owner.session),
        )
      ).status,
    ).toBe(200);

    // Invites work without entitlement; invitee can accept and edit.
    const inv = (await (
      await h.json(`/v1/moves/${moveId}/invites`, { role: 'editor' }, auth(owner.session))
    ).json()) as { token: string };
    const ed = await h.login('ed', 'ed@x.com', { entitled: false });
    expect((await h.json(`/v1/invites/${inv.token}/accept`, {}, auth(ed.session))).status).toBe(200);
    expect(
      (
        await h.json(
          `/v1/moves/${moveId}/mutations`,
          {
            mutations: [m('addItem', { id: 'i2', boxId: 'b1', name: 'Mug', qty: 4, valueCents: 1200 }, 'c3')],
          },
          auth(ed.session),
        )
      ).status,
    ).toBe(200);

    // Reserving a photo record works without entitlement.
    const photo = await h.json(`/v1/moves/${moveId}/photos`, { itemId: 'i1' }, auth(owner.session));
    expect(photo.status).toBe(200);
    const { uploadPath } = (await photo.json()) as { uploadPath: string };
    expect(
      (
        await h.request(uploadPath, {
          method: 'PUT',
          body: new Uint8Array([1, 2, 3]),
          ...auth(owner.session),
        })
      ).status,
    ).toBe(200);
  });
});
