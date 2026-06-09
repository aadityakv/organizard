import type { Mutation } from '@shared/index';
import { describe, expect, it } from 'vitest';

import { makeHarness } from './helpers/harness';

const auth = (session: string) => ({ headers: { Authorization: `Bearer ${session}` } });
const m = (type: string, payload: unknown, clientId: string): Mutation =>
  ({ type, clientId, ts: 1, payload }) as unknown as Mutation;

type Snapshot = {
  move: { id: string; name: string; from: string | null; to: string | null; targetDate: string | null };
};

async function createMove(h: Awaited<ReturnType<typeof makeHarness>>, session: string) {
  const res = await h.json('/v1/moves', { name: 'NYC Move' }, auth(session));
  expect(res.status).toBe(201);
  return (await res.json()) as Snapshot;
}

describe('updateMove — edits the move row', () => {
  it('applies name/from/to/target and reflects them in the snapshot', async () => {
    const h = await makeHarness();
    const { session } = await h.login('owner', 'o@x.com');
    const snap0 = await createMove(h, session);
    const moveId = snap0.move.id;

    const res = await h.json(`/v1/moves/${moveId}/mutations`, {
      mutations: [
        m('updateMove', { name: 'Cross-country move', from: '1 Old St', to: '2 New Ave', target: 'Jul 12, 2026' }, 'c1'),
      ],
    }, auth(session));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { applied: number }).applied).toBe(1);

    const snap = (await (await h.request(`/v1/moves/${moveId}`, auth(session))).json()) as Snapshot;
    expect(snap.move.name).toBe('Cross-country move');
    expect(snap.move.from).toBe('1 Old St');
    expect(snap.move.to).toBe('2 New Ave');
    expect(snap.move.targetDate).toBe('Jul 12, 2026');
  });

  it('updates only the fields present (partial patch leaves others intact)', async () => {
    const h = await makeHarness();
    const { session } = await h.login('owner', 'o@x.com');
    const snap0 = await createMove(h, session);
    const moveId = snap0.move.id;

    // Seed all fields first.
    await h.json(`/v1/moves/${moveId}/mutations`, {
      mutations: [m('updateMove', { name: 'Move A', from: 'A', to: 'B', target: 'Jan 1, 2026' }, 'c1')],
    }, auth(session));

    // Patch only the target date.
    const res = await h.json(`/v1/moves/${moveId}/mutations`, {
      mutations: [m('updateMove', { target: 'Aug 3, 2026' }, 'c2')],
    }, auth(session));
    expect(res.status).toBe(200);

    const snap = (await (await h.request(`/v1/moves/${moveId}`, auth(session))).json()) as Snapshot;
    expect(snap.move.name).toBe('Move A');
    expect(snap.move.from).toBe('A');
    expect(snap.move.to).toBe('B');
    expect(snap.move.targetDate).toBe('Aug 3, 2026');
  });

  it('rejects updateMove from a viewer (role-gated)', async () => {
    const h = await makeHarness();
    const owner = await h.login('owner', 'o@x.com');
    const snap0 = await createMove(h, owner.session);
    const moveId = snap0.move.id;

    const viewer = await h.login('viewer', 'v@x.com');
    await h.seedMember(moveId, viewer.user.id, 'viewer');

    const res = await h.json(`/v1/moves/${moveId}/mutations`, {
      mutations: [m('updateMove', { name: 'Hacked' }, 'c9')],
    }, auth(viewer.session));
    expect(res.status).toBe(403);
  });
});
