import type { Mutation } from '@shared/index';
import { describe, expect, it } from 'vitest';

import { makeHarness } from './helpers/harness';

const auth = (session: string) => ({ headers: { Authorization: `Bearer ${session}` } });
const m = (type: string, payload: unknown, clientId: string): Mutation =>
  ({ type, clientId, ts: 1, payload }) as unknown as Mutation;

type Room = { id: string; name: string; color: string; deletedAt?: number | null };
type Snapshot = { move: { id: string }; rooms: Room[] };

async function createMove(h: Awaited<ReturnType<typeof makeHarness>>, session: string) {
  const res = await h.json('/v1/moves', { name: 'NYC Move' }, auth(session));
  expect(res.status).toBe(201);
  return (await res.json()) as Snapshot;
}

describe('rooms — color field', () => {
  it('addRoom carries color into the snapshot, updateRoom changes it in the delta', async () => {
    const h = await makeHarness();
    const { session } = await h.login('owner', 'o@x.com');
    const snap0 = await createMove(h, session);
    const moveId = snap0.move.id;

    await h.json(
      `/v1/moves/${moveId}/mutations`,
      {
        mutations: [m('addRoom', { id: 'room1', name: 'Kitchen', icon: 'cooking-pot', color: 'teal' }, 'c1')],
      },
      auth(session),
    );

    const snap = (await (await h.request(`/v1/moves/${moveId}`, auth(session))).json()) as Snapshot;
    expect(snap.rooms).toHaveLength(1);
    expect(snap.rooms[0].color).toBe('teal');

    await h.json(
      `/v1/moves/${moveId}/mutations`,
      { mutations: [m('updateRoom', { id: 'room1', color: 'rose' }, 'c2')] },
      auth(session),
    );

    const changes = (await (
      await h.request(`/v1/moves/${moveId}/changes?since=0`, auth(session))
    ).json()) as {
      rooms: Room[];
    };
    const room1 = changes.rooms.find((r) => r.id === 'room1');
    expect(room1?.color).toBe('rose');
  });

  it('addRoom without color defaults to slate', async () => {
    const h = await makeHarness();
    const { session } = await h.login('owner', 'o@x.com');
    const snap0 = await createMove(h, session);
    const moveId = snap0.move.id;

    await h.json(
      `/v1/moves/${moveId}/mutations`,
      { mutations: [m('addRoom', { id: 'room1', name: 'Garage', icon: 'box' }, 'c1')] },
      auth(session),
    );

    const snap = (await (await h.request(`/v1/moves/${moveId}`, auth(session))).json()) as Snapshot;
    expect(snap.rooms[0].color).toBe('slate');
  });
});

describe('rooms — delete cascades', () => {
  it('deleteRoom tombstones the room, its boxes and their items', async () => {
    const h = await makeHarness();
    const { session } = await h.login('owner', 'o@x.com');
    const snap0 = await createMove(h, session);
    const moveId = snap0.move.id;
    const statusId = (snap0 as unknown as { statuses: { id: string }[] }).statuses[0].id;

    await h.json(
      `/v1/moves/${moveId}/mutations`,
      {
        mutations: [
          m('addRoom', { id: 'room1', name: 'Kitchen', icon: 'box' }, 'c1'),
          m(
            'addBox',
            { id: 'box1', roomId: 'room1', number: 1, name: 'Pots', color: 'amber', statusId },
            'c2',
          ),
          m('addItem', { id: 'item1', boxId: 'box1', name: 'Skillet', qty: 1, valueCents: 800 }, 'c3'),
        ],
      },
      auth(session),
    );

    await h.json(
      `/v1/moves/${moveId}/mutations`,
      { mutations: [m('deleteRoom', { id: 'room1' }, 'c4')] },
      auth(session),
    );

    // The snapshot drops all three; the delta carries all three as tombstones.
    const snap = (await (await h.request(`/v1/moves/${moveId}`, auth(session))).json()) as {
      rooms: unknown[];
      boxes: unknown[];
      items: unknown[];
    };
    expect(snap.rooms).toEqual([]);
    expect(snap.boxes).toEqual([]);
    expect(snap.items).toEqual([]);

    const changes = (await (
      await h.request(`/v1/moves/${moveId}/changes?since=0`, auth(session))
    ).json()) as {
      rooms: Room[];
      boxes: { id: string; deletedAt?: number | null }[];
      items: { id: string; deletedAt?: number | null }[];
    };
    expect(changes.rooms.find((r) => r.id === 'room1')?.deletedAt).not.toBeNull();
    expect(changes.boxes.find((b) => b.id === 'box1')?.deletedAt).not.toBeNull();
    expect(changes.items.find((i) => i.id === 'item1')?.deletedAt).not.toBeNull();
  });
});
