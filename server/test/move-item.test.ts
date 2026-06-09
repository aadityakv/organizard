import type { Mutation } from '@shared/index';
import { describe, expect, it } from 'vitest';

import { makeHarness } from './helpers/harness';

const auth = (session: string) => ({ headers: { Authorization: `Bearer ${session}` } });
const m = (type: string, payload: unknown, clientId: string): Mutation =>
  ({ type, clientId, ts: 1, payload }) as unknown as Mutation;

type Snapshot = {
  move: { id: string };
  statuses: { id: string }[];
  items: { id: string; boxId: string }[];
};

async function createMove(h: Awaited<ReturnType<typeof makeHarness>>, session: string) {
  const res = await h.json('/v1/moves', { name: 'NYC Move' }, auth(session));
  expect(res.status).toBe(201);
  return (await res.json()) as Snapshot;
}

describe('moveItem — moves an item between boxes', () => {
  it('moves the item from box A to box B (reflected in snapshot)', async () => {
    const h = await makeHarness();
    const { session } = await h.login('owner', 'o@x.com');
    const snap0 = await createMove(h, session);
    const moveId = snap0.move.id;
    const statusId = snap0.statuses[0].id;

    // room + two boxes (A, B) + an item in box A
    await h.json(`/v1/moves/${moveId}/mutations`, {
      mutations: [
        m('addRoom', { id: 'room1', name: 'Kitchen', icon: 'cooking-pot' }, 'c1'),
        m('addBox', { id: 'boxA', roomId: 'room1', number: 1, name: 'A', color: 'amber', statusId }, 'c2'),
        m('addBox', { id: 'boxB', roomId: 'room1', number: 2, name: 'B', color: 'sky', statusId }, 'c3'),
        m('addItem', { id: 'item1', boxId: 'boxA', name: 'Skillet', qty: 1, valueCents: 8000 }, 'c4'),
      ],
    }, auth(session));

    // move the item from A -> B
    const res = await h.json(`/v1/moves/${moveId}/mutations`, {
      mutations: [m('moveItem', { id: 'item1', fromBoxId: 'boxA', toBoxId: 'boxB' }, 'c5')],
    }, auth(session));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { applied: number }).applied).toBe(1);

    const snap = (await (await h.request(`/v1/moves/${moveId}`, auth(session))).json()) as Snapshot;
    const item = snap.items.find((it) => it.id === 'item1');
    expect(item?.boxId).toBe('boxB');
  });

  it('ignores a moveItem whose toBoxId is not in the move (item stays in box A)', async () => {
    const h = await makeHarness();
    const { session } = await h.login('owner', 'o@x.com');
    const snap0 = await createMove(h, session);
    const moveId = snap0.move.id;
    const statusId = snap0.statuses[0].id;

    await h.json(`/v1/moves/${moveId}/mutations`, {
      mutations: [
        m('addRoom', { id: 'room1', name: 'Kitchen', icon: 'cooking-pot' }, 'c1'),
        m('addBox', { id: 'boxA', roomId: 'room1', number: 1, name: 'A', color: 'amber', statusId }, 'c2'),
        m('addItem', { id: 'item1', boxId: 'boxA', name: 'Skillet', qty: 1, valueCents: 8000 }, 'c3'),
      ],
    }, auth(session));

    // toBoxId is a foreign/non-existent box -> must be a no-op
    const res = await h.json(`/v1/moves/${moveId}/mutations`, {
      mutations: [m('moveItem', { id: 'item1', fromBoxId: 'boxA', toBoxId: 'boxNOPE' }, 'c4')],
    }, auth(session));
    expect(res.status).toBe(200);

    const snap = (await (await h.request(`/v1/moves/${moveId}`, auth(session))).json()) as Snapshot;
    const item = snap.items.find((it) => it.id === 'item1');
    expect(item?.boxId).toBe('boxA');
  });
});
