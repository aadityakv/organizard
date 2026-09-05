import type { Mutation } from '@shared/index';
import { describe, expect, it } from 'vitest';

import { makeHarness } from './helpers/harness';

const auth = (session: string) => ({ headers: { Authorization: `Bearer ${session}` } });
const m = (type: string, payload: unknown, clientId: string): Mutation =>
  ({ type, clientId, ts: 1, payload }) as unknown as Mutation;

type Snapshot = {
  move: { id: string };
  statuses: { id: string }[];
  items: { id: string; boxId: string; unpackedAt?: number | null; updatedAt: number }[];
};

const NOW = 1_700_000_000_000;

/** A move with one box holding one item; returns ids and the owner's session. */
async function seed(h: Awaited<ReturnType<typeof makeHarness>>) {
  const { session } = await h.login('owner', 'o@x.com');
  const res = await h.json('/v1/moves', { name: 'NYC Move' }, auth(session));
  expect(res.status).toBe(201);
  const snap0 = (await res.json()) as Snapshot;
  const moveId = snap0.move.id;
  const statusId = snap0.statuses[0].id;
  const setup = await h.json(
    `/v1/moves/${moveId}/mutations`,
    {
      mutations: [
        m('addRoom', { id: 'room1', name: 'Kitchen', icon: 'cooking-pot' }, 'c1'),
        m('addBox', { id: 'boxA', roomId: 'room1', number: 1, name: 'A', color: 'amber', statusId }, 'c2'),
        m('addItem', { id: 'item1', boxId: 'boxA', name: 'Skillet', qty: 1, valueCents: 8000 }, 'c3'),
      ],
    },
    auth(session),
  );
  expect(setup.status).toBe(200);
  return { session, moveId };
}

const snapshot = async (h: Awaited<ReturnType<typeof makeHarness>>, moveId: string, session: string) =>
  (await (await h.request(`/v1/moves/${moveId}`, auth(session))).json()) as Snapshot;

describe('setItemUnpacked — ticks an item off during unpacking', () => {
  it('stamps unpackedAt with the server time, and clears it when turned off', async () => {
    const h = await makeHarness({ now: NOW });
    const { session, moveId } = await seed(h);

    const on = await h.json(
      `/v1/moves/${moveId}/mutations`,
      { mutations: [m('setItemUnpacked', { id: 'item1', boxId: 'boxA', on: true }, 'c4')] },
      auth(session),
    );
    expect(on.status).toBe(200);
    expect(((await on.json()) as { applied: number }).applied).toBe(1);
    expect((await snapshot(h, moveId, session)).items[0].unpackedAt).toBe(NOW);

    const off = await h.json(
      `/v1/moves/${moveId}/mutations`,
      { mutations: [m('setItemUnpacked', { id: 'item1', boxId: 'boxA', on: false }, 'c5')] },
      auth(session),
    );
    expect(off.status).toBe(200);
    expect((await snapshot(h, moveId, session)).items[0].unpackedAt).toBeNull();
  });

  it('starts null, rides the delta after a tick, and is a no-op on a retry', async () => {
    const h = await makeHarness({ now: NOW });
    const { session, moveId } = await seed(h);
    expect((await snapshot(h, moveId, session)).items[0].unpackedAt).toBeNull();

    const tick = m('setItemUnpacked', { id: 'item1', boxId: 'boxA', on: true }, 'c4');
    await h.json(`/v1/moves/${moveId}/mutations`, { mutations: [tick] }, auth(session));
    const retry = await h.json(`/v1/moves/${moveId}/mutations`, { mutations: [tick] }, auth(session));
    expect(((await retry.json()) as { applied: number }).applied).toBe(0);

    const delta = (await (
      await h.request(`/v1/moves/${moveId}/changes?since=${NOW - 1}`, auth(session))
    ).json()) as { items: Snapshot['items'] };
    expect(delta.items.map((it) => [it.id, it.unpackedAt])).toEqual([['item1', NOW]]);
  });

  it('ignores an item outside the move and rejects a malformed payload', async () => {
    const h = await makeHarness({ now: NOW });
    const { session, moveId } = await seed(h);

    const foreign = await h.json(
      `/v1/moves/${moveId}/mutations`,
      { mutations: [m('setItemUnpacked', { id: 'nope', boxId: 'boxA', on: true }, 'c4')] },
      auth(session),
    );
    expect(foreign.status).toBe(200);
    expect((await snapshot(h, moveId, session)).items[0].unpackedAt).toBeNull();

    const bad = await h.json(
      `/v1/moves/${moveId}/mutations`,
      { mutations: [m('setItemUnpacked', { id: 'item1', boxId: 'boxA', on: 'yes' }, 'c5')] },
      auth(session),
    );
    expect(bad.status).toBe(400);
  });
});
