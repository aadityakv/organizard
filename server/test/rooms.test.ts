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
