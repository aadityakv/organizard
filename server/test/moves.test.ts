import type { Mutation } from '@shared/index';
import { describe, expect, it } from 'vitest';

import { makeHarness } from './helpers/harness';

const auth = (session: string) => ({ headers: { Authorization: `Bearer ${session}` } });
const m = (type: string, payload: unknown, clientId: string): Mutation =>
  ({ type, clientId, ts: 1, payload }) as unknown as Mutation;

type Snapshot = {
  move: { id: string; name: string };
  members: { role: string }[];
  rooms: unknown[];
  statuses: { id: string; label: string }[];
  markers: { id: string }[];
  boxes: { id: string; statusId: string; markerIds: string[] }[];
  items: { id: string; name: string; valueCents: number; markerIds: string[] }[];
};

async function createMove(h: Awaited<ReturnType<typeof makeHarness>>, session: string) {
  const res = await h.json('/v1/moves', { name: 'NYC Move' }, auth(session));
  expect(res.status).toBe(201);
  return (await res.json()) as Snapshot;
}

describe('moves — create + snapshot', () => {
  it('seeds 4 statuses, 5 markers, and an owner membership', async () => {
    const h = await makeHarness();
    const { session } = await h.login('owner', 'o@x.com');
    const snap = await createMove(h, session);

    expect(snap.move.name).toBe('NYC Move');
    expect(snap.statuses).toHaveLength(4);
    expect(snap.markers).toHaveLength(5);
    expect(snap.members).toHaveLength(1);
    expect(snap.members[0].role).toBe('owner');
    expect(snap.boxes).toHaveLength(0);
  });
});

describe('moves — mutation batch', () => {
  it('applies room/box/item and the snapshot reflects them', async () => {
    const h = await makeHarness();
    const { session } = await h.login('owner', 'o@x.com');
    const snap0 = await createMove(h, session);
    const moveId = snap0.move.id;
    const statusId = snap0.statuses[0].id;
    const markerId = snap0.markers[0].id;

    const muts: Mutation[] = [
      m('addRoom', { id: 'room1', name: 'Kitchen', dest: 'NYC kitchen', icon: 'cooking-pot' }, 'c1'),
      m('addBox', { id: 'box1', roomId: 'room1', number: 1, name: 'Pots', color: 'amber', statusId }, 'c2'),
      m('addItem', { id: 'item1', boxId: 'box1', name: 'Skillet', qty: 1, valueCents: 8000, markerIds: [markerId] }, 'c3'),
      m('setBoxMarker', { boxId: 'box1', markerId, on: true }, 'c4'),
    ];
    const res = await h.json(`/v1/moves/${moveId}/mutations`, { mutations: muts }, auth(session));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { applied: number }).applied).toBe(4);

    const snap = (await (await h.request(`/v1/moves/${moveId}`, auth(session))).json()) as Snapshot;
    expect(snap.rooms).toHaveLength(1);
    expect(snap.boxes).toHaveLength(1);
    expect(snap.boxes[0].statusId).toBe(statusId);
    expect(snap.boxes[0].markerIds).toEqual([markerId]);
    expect(snap.items).toHaveLength(1);
    expect(snap.items[0].valueCents).toBe(8000);
    expect(snap.items[0].markerIds).toEqual([markerId]);
  });

  it('is idempotent on repeated clientId', async () => {
    const h = await makeHarness();
    const { session } = await h.login('owner', 'o@x.com');
    const snap0 = await createMove(h, session);
    const moveId = snap0.move.id;
    const batch = { mutations: [m('addRoom', { id: 'r1', name: 'Office', icon: 'briefcase' }, 'dup')] };

    await h.json(`/v1/moves/${moveId}/mutations`, batch, auth(session));
    const second = await h.json(`/v1/moves/${moveId}/mutations`, batch, auth(session));
    expect(((await second.json()) as { applied: number }).applied).toBe(0); // skipped

    const snap = (await (await h.request(`/v1/moves/${moveId}`, auth(session))).json()) as Snapshot;
    expect(snap.rooms).toHaveLength(1); // not duplicated
  });

  it('soft-delete tombstones appear in the delta but not the snapshot', async () => {
    const h = await makeHarness();
    const { session } = await h.login('owner', 'o@x.com');
    const snap0 = await createMove(h, session);
    const moveId = snap0.move.id;

    await h.json(`/v1/moves/${moveId}/mutations`, { mutations: [m('addRoom', { id: 'r1', name: 'Bath', icon: 'bath' }, 'c1')] }, auth(session));
    await h.json(`/v1/moves/${moveId}/mutations`, { mutations: [m('deleteRoom', { id: 'r1' }, 'c2')] }, auth(session));

    const snap = (await (await h.request(`/v1/moves/${moveId}`, auth(session))).json()) as Snapshot;
    expect(snap.rooms).toHaveLength(0); // gone from snapshot

    const changes = (await (await h.request(`/v1/moves/${moveId}/changes?since=0`, auth(session))).json()) as {
      rooms: { id: string; deletedAt: number | null }[];
    };
    const r1 = changes.rooms.find((r) => r.id === 'r1');
    expect(r1?.deletedAt).toBeTruthy(); // tombstone present in delta
  });
});

describe('moves — permissions', () => {
  it('viewer cannot mutate; editor can edit but not delete a box; owner can', async () => {
    const h = await makeHarness();
    const owner = await h.login('owner', 'o@x.com');
    const snap0 = await createMove(h, owner.session);
    const moveId = snap0.move.id;
    const statusId = snap0.statuses[0].id;

    // owner adds a box for later delete tests
    await h.json(`/v1/moves/${moveId}/mutations`, { mutations: [m('addBox', { id: 'b1', roomId: 'r0', number: 1, name: 'X', color: 'sky', statusId }, 'o1')] }, auth(owner.session));

    const viewer = await h.login('viewer', 'v@x.com');
    await h.seedMember(moveId, viewer.user.id, 'viewer');
    const vres = await h.json(`/v1/moves/${moveId}/mutations`, { mutations: [m('addRoom', { id: 'r9', name: 'No', icon: 'box' }, 'v1')] }, auth(viewer.session));
    expect(vres.status).toBe(403);

    const editor = await h.login('editor', 'e@x.com');
    await h.seedMember(moveId, editor.user.id, 'editor');
    const eEdit = await h.json(`/v1/moves/${moveId}/mutations`, { mutations: [m('addRoom', { id: 'r2', name: 'Yes', icon: 'box' }, 'e1')] }, auth(editor.session));
    expect(eEdit.status).toBe(200);
    const eDelete = await h.json(`/v1/moves/${moveId}/mutations`, { mutations: [m('deleteBox', { id: 'b1' }, 'e2')] }, auth(editor.session));
    expect(eDelete.status).toBe(403); // deleteBox is owner-only

    const oDelete = await h.json(`/v1/moves/${moveId}/mutations`, { mutations: [m('deleteBox', { id: 'b1' }, 'o2')] }, auth(owner.session));
    expect(oDelete.status).toBe(200);
  });

  it('non-members get 404 (existence not leaked)', async () => {
    const h = await makeHarness();
    const owner = await h.login('owner', 'o@x.com');
    const snap0 = await createMove(h, owner.session);

    const stranger = await h.login('stranger', 's@x.com');
    const res = await h.request(`/v1/moves/${snap0.move.id}`, auth(stranger.session));
    expect(res.status).toBe(404);
  });
});

describe('me — lists the user\'s moves', () => {
  it('returns the created move with the owner role', async () => {
    const h = await makeHarness();
    const { session } = await h.login('owner', 'o@x.com');
    await createMove(h, session);
    const me = (await (await h.request('/v1/me', auth(session))).json()) as { moves: { name: string; role: string }[] };
    expect(me.moves).toHaveLength(1);
    expect(me.moves[0].role).toBe('owner');
  });
});
