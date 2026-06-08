import type { Mutation } from '@shared/index';
import { describe, expect, it } from 'vitest';

import { makeHarness } from './helpers/harness';

const auth = (s: string) => ({ headers: { Authorization: `Bearer ${s}` } });
const m = (type: string, payload: unknown, clientId: string): Mutation =>
  ({ type, clientId, ts: 1, payload }) as unknown as Mutation;

describe('delta — large change set', () => {
  it('returns every changed row in one unbounded delta (no rows dropped)', async () => {
    const h = await makeHarness();
    const { session } = await h.login('o', 'o@x.com');
    const moveId = ((await (await h.json('/v1/moves', { name: 'M' }, auth(session))).json()) as { move: { id: string } }).move.id;

    // 250 rooms in one batch
    const muts = Array.from({ length: 250 }, (_, i) => m('addRoom', { id: `r${i}`, name: `R${i}`, icon: 'box' }, `c${i}`));
    await h.json(`/v1/moves/${moveId}/mutations`, { mutations: muts }, auth(session));

    const ch = (await (await h.request(`/v1/moves/${moveId}/changes?since=0`, auth(session))).json()) as {
      rooms: { id: string }[];
      hasMore: boolean;
    };
    expect(new Set(ch.rooms.map((r) => r.id)).size).toBe(250); // all delivered
    expect(ch.hasMore).toBe(false);
  });
});
