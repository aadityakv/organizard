import type { Mutation } from '@shared/index';
import { describe, expect, it } from 'vitest';

import { makeHarness } from './helpers/harness';

const auth = (s: string) => ({ headers: { Authorization: `Bearer ${s}` } });
const m = (type: string, payload: unknown, clientId: string): Mutation =>
  ({ type, clientId, ts: 1, payload }) as unknown as Mutation;

describe('delta pagination', () => {
  it('pages a large change set without dropping rows', async () => {
    const h = await makeHarness();
    const { session } = await h.login('o', 'o@x.com');
    const moveId = ((await (await h.json('/v1/moves', { name: 'M' }, auth(session))).json()) as { move: { id: string } }).move.id;

    // 250 rooms in one batch (> the 200 page limit)
    const muts = Array.from({ length: 250 }, (_, i) => m('addRoom', { id: `r${i}`, name: `R${i}`, icon: 'box' }, `c${i}`));
    await h.json(`/v1/moves/${moveId}/mutations`, { mutations: muts }, auth(session));

    const seen = new Set<string>();
    let since = 0;
    let hasMore = true;
    let pages = 0;
    while (hasMore && pages < 10) {
      const ch = (await (await h.request(`/v1/moves/${moveId}/changes?since=${since}`, auth(session))).json()) as {
        rooms: { id: string }[];
        cursor: number;
        hasMore: boolean;
      };
      for (const r of ch.rooms) seen.add(r.id);
      since = ch.cursor;
      hasMore = ch.hasMore;
      pages += 1;
    }

    expect(seen.size).toBe(250); // every room delivered, none skipped
    expect(pages).toBeGreaterThan(1); // it actually paginated
  });
});
