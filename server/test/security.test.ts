import type { Mutation } from '@shared/index';
import { describe, expect, it } from 'vitest';

import { makeHarness } from './helpers/harness';

const auth = (session: string) => ({ headers: { Authorization: `Bearer ${session}` } });
const m = (type: string, payload: unknown, clientId: string): Mutation =>
  ({ type, clientId, ts: 1, payload }) as unknown as Mutation;

type Snap = {
  move: { id: string };
  statuses: { id: string }[];
  markers: { id: string }[];
  boxes: { id: string; markerIds: string[] }[];
  items: { id: string }[];
};
const create = async (h: Awaited<ReturnType<typeof makeHarness>>, session: string) =>
  (await (await h.json('/v1/moves', { name: 'M' }, auth(session))).json()) as Snap;
const snapshot = async (h: Awaited<ReturnType<typeof makeHarness>>, session: string, moveId: string) =>
  (await (await h.request(`/v1/moves/${moveId}`, auth(session))).json()) as Snap;

describe('security — cross-move isolation (IDOR)', () => {
  it('mutations on move A cannot touch move B rows even for a member of both', async () => {
    const h = await makeHarness();
    const owner = await h.login('owner', 'o@x.com'); // member of both A and B

    const a = await create(h, owner.session);
    const b = await create(h, owner.session);

    const bMarker = b.markers[0].id;
    await h.json(
      `/v1/moves/${b.move.id}/mutations`,
      {
        mutations: [
          m(
            'addBox',
            { id: 'bB', roomId: 'rB', number: 1, name: 'B box', color: 'sky', statusId: b.statuses[0].id },
            'x0',
          ),
        ],
      },
      auth(owner.session),
    );
    // addBox needs its room to exist first -> create the room, then the box
    await h.json(
      `/v1/moves/${b.move.id}/mutations`,
      { mutations: [m('addRoom', { id: 'rB', name: 'RB', icon: 'box' }, 'x1')] },
      auth(owner.session),
    );
    await h.json(
      `/v1/moves/${b.move.id}/mutations`,
      {
        mutations: [
          m(
            'addBox',
            { id: 'bB', roomId: 'rB', number: 1, name: 'B box', color: 'sky', statusId: b.statuses[0].id },
            'x2',
          ),
        ],
      },
      auth(owner.session),
    );

    // From move A, try to: link B's marker onto B's box, and add an item into B's box.
    await h.json(
      `/v1/moves/${a.move.id}/mutations`,
      {
        mutations: [
          m('setBoxMarker', { boxId: 'bB', markerId: bMarker, on: true }, 'a1'),
          m('addItem', { id: 'iX', boxId: 'bB', name: 'sneaky', qty: 1, valueCents: 1 }, 'a2'),
        ],
      },
      auth(owner.session),
    );

    // B is untouched: its box has no marker, and the cross-move item never landed.
    const snapB = await snapshot(h, owner.session, b.move.id);
    expect(snapB.boxes.find((x) => x.id === 'bB')?.markerIds ?? []).toEqual([]);
    expect(snapB.items.find((x) => x.id === 'iX')).toBeUndefined();

    // A is untouched too: the item referencing a foreign box was skipped.
    const snapA = await snapshot(h, owner.session, a.move.id);
    expect(snapA.items.find((x) => x.id === 'iX')).toBeUndefined();
  });

  it('addBox referencing a foreign room/status is skipped', async () => {
    const h = await makeHarness();
    const owner = await h.login('owner', 'o@x.com');
    const a = await create(h, owner.session);
    const b = await create(h, owner.session);
    await h.json(
      `/v1/moves/${b.move.id}/mutations`,
      { mutations: [m('addRoom', { id: 'rB', name: 'RB', icon: 'box' }, 'x1')] },
      auth(owner.session),
    );

    // A box in A that points at B's room + B's status -> skipped (foreign refs)
    await h.json(
      `/v1/moves/${a.move.id}/mutations`,
      {
        mutations: [
          m(
            'addBox',
            { id: 'bA', roomId: 'rB', number: 1, name: 'x', color: 'green', statusId: b.statuses[0].id },
            'a1',
          ),
        ],
      },
      auth(owner.session),
    );

    const snapA = await snapshot(h, owner.session, a.move.id);
    expect(snapA.boxes.find((x) => x.id === 'bA')).toBeUndefined();
  });
});
