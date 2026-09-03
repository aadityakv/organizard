import type { Mutation } from '@shared/index';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import * as schema from '../src/db/schema';
import { makeHarness } from './helpers/harness';

const auth = (s: string) => ({ headers: { Authorization: `Bearer ${s}` } });
const mut = (type: string, payload: unknown, clientId: string): Mutation =>
  ({ type, clientId, ts: 1, payload }) as unknown as Mutation;

async function ownerWithMove(h: Awaited<ReturnType<typeof makeHarness>>) {
  const owner = await h.login('owner', 'o@x.com');
  const snap = (await (await h.json('/v1/moves', { name: 'NYC' }, auth(owner.session))).json()) as {
    move: { id: string };
    statuses: { id: string }[];
  };
  return { owner, moveId: snap.move.id, statusId: snap.statuses[0].id };
}

describe('DELETE /v1/moves/:id', () => {
  it('owner deletes the move and it is gone', async () => {
    const h = await makeHarness();
    const { owner, moveId } = await ownerWithMove(h);
    const del = await h.request(`/v1/moves/${moveId}`, { method: 'DELETE', ...auth(owner.session) });
    expect(del.status).toBe(200);
    expect((await h.request(`/v1/moves/${moveId}`, auth(owner.session))).status).toBe(404);
  });

  it('an editor cannot delete (403)', async () => {
    const h = await makeHarness();
    const { owner, moveId } = await ownerWithMove(h);
    const inv = (await (
      await h.json(`/v1/moves/${moveId}/invites`, { role: 'editor' }, auth(owner.session))
    ).json()) as { token: string };
    const jo = await h.login('jo', 'jo@x.com');
    await h.json(`/v1/invites/${inv.token}/accept`, {}, auth(jo.session));
    const del = await h.request(`/v1/moves/${moveId}`, { method: 'DELETE', ...auth(jo.session) });
    expect(del.status).toBe(403);
  });

  it('a non-member gets 404 (existence not leaked)', async () => {
    const h = await makeHarness();
    const { moveId } = await ownerWithMove(h);
    const stranger = await h.login('x', 'x@x.com');
    const del = await h.request(`/v1/moves/${moveId}`, { method: 'DELETE', ...auth(stranger.session) });
    expect(del.status).toBe(404);
  });

  // Guards the explicit cascade in deleteMove(): the sql.js test driver doesn't
  // enforce FKs, so a forgotten/reordered child-table delete would silently leak
  // rows yet still pass the "move 404s" check. We seed every child table, then
  // query the harness db directly (makeHarness returns the AppDb) for leftovers.
  it('owner delete removes all child rows (cascade)', async () => {
    const h = await makeHarness();
    const { owner, moveId, statusId } = await ownerWithMove(h);

    // Seed a row in each child table via the real mutation endpoint: a room, a
    // (custom) marker, a box in that room, a box marker, and an item carrying
    // the same marker. addBox needs a real statusId; setBoxMarker/addItem need
    // the marker to exist in-move.
    const muts: Mutation[] = [
      mut('addRoom', { id: 'room1', name: 'Kitchen', dest: 'NYC kitchen', icon: 'cooking-pot' }, 'c1'),
      mut('addMarker', { id: 'mk1', label: 'Fragile', color: 'red', icon: 'alert-triangle' }, 'c2'),
      mut('addBox', { id: 'box1', roomId: 'room1', number: 1, name: 'Pots', color: 'amber', statusId }, 'c3'),
      mut('setBoxMarker', { boxId: 'box1', markerId: 'mk1', on: true }, 'c4'),
      mut(
        'addItem',
        { id: 'item1', boxId: 'box1', name: 'Skillet', qty: 1, valueCents: 8000, markerIds: ['mk1'] },
        'c5',
      ),
    ];
    const applied = await h.json(`/v1/moves/${moveId}/mutations`, { mutations: muts }, auth(owner.session));
    expect(applied.status).toBe(200);
    expect(((await applied.json()) as { applied: number }).applied).toBe(5);

    // Sanity-check the snapshot reflects the box + item + their marker before delete.
    const snap = (await (await h.request(`/v1/moves/${moveId}`, auth(owner.session))).json()) as {
      boxes: { id: string; markerIds: string[] }[];
      items: { id: string; markerIds: string[] }[];
      rooms: unknown[];
    };
    expect(snap.rooms).toHaveLength(1);
    expect(snap.boxes).toHaveLength(1);
    expect(snap.boxes[0].markerIds).toEqual(['mk1']);
    expect(snap.items).toHaveLength(1);
    expect(snap.items[0].markerIds).toEqual(['mk1']);

    const del = await h.request(`/v1/moves/${moveId}`, { method: 'DELETE', ...auth(owner.session) });
    expect(del.status).toBe(200);

    // Every child table must be empty for this move. The join tables (box_markers,
    // item_markers) have no move_id, so we key them off the seeded box/item ids.
    const byMove = [
      schema.boxes,
      schema.items,
      schema.rooms,
      schema.markers,
      schema.statuses,
      schema.members,
    ] as const;
    for (const table of byMove) {
      const rows = await h.db.select().from(table).where(eq(table.moveId, moveId));
      expect(rows, `${(table as { _: { name?: string } })._?.name ?? 'table'} rows for move`).toEqual([]);
    }
    expect(await h.db.select().from(schema.boxMarkers).where(eq(schema.boxMarkers.boxId, 'box1'))).toEqual(
      [],
    );
    expect(
      await h.db.select().from(schema.itemMarkers).where(eq(schema.itemMarkers.itemId, 'item1')),
    ).toEqual([]);
  });
});
