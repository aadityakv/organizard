import { describe, expect, it } from 'vitest';

import { STATUS_ID } from '@/data/defaults';
import type { ServerChanges, ServerSnapshot } from '@/lib/api';

import { createAppStore } from './createStore';
import { unpackProgress } from './selectors';

/** Synchronous in-memory storage so the store hydrates before the first read. */
const memoryStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

/** A shared move (so the outbox records mutations) with one sealed box of two items. */
function sharedBox() {
  const store = createAppStore(memoryStorage());
  const s = store.getState();
  s.setSession('tok', { id: 'u1', name: 'Me', email: null, entitlementActive: false });
  s.createMove({ name: 'Move' });
  s.goShared('srv1');
  const roomId = s.addRoom({ name: 'Kitchen' });
  const boxId = s.addBox({ name: 'Pans', color: 'amber', roomId, status: STATUS_ID.sealed });
  const a = s.addItem(boxId, { name: 'Skillet' });
  const b = s.addItem(boxId, { name: 'Kettle' });
  s.clearOutbox(store.getState().outbox.map((m) => m.clientId));
  return { store, boxId, a, b };
}

const itemsOf = (store: ReturnType<typeof createAppStore>, boxId: string) =>
  store.getState().itemsByBox[boxId] ?? [];

/**
 * A delta carrying only item rows. Members ride every delta in the real protocol; a
 * move opened via goShared has none locally yet, so default to the account as owner
 * (what the first pull would bring), otherwise echo the store's members.
 */
const delta = (
  store: ReturnType<typeof createAppStore>,
  items: ServerChanges['items'],
  cursor = 1000,
): ServerChanges => {
  const current = store.getState().members;
  const members = current.length
    ? current.map((m) => ({ id: m.id, moveId: 'srv1', userId: m.id, role: m.role, name: m.name }))
    : [{ id: 'm1', moveId: 'srv1', userId: 'u1', role: 'owner' as const, name: 'Me' }];
  return {
    serverTime: cursor + 1,
    cursor,
    hasMore: false,
    move: null,
    rooms: [],
    statuses: [],
    markers: [],
    boxes: [],
    items,
    members,
  };
};

const serverItem = (
  id: string,
  boxId: string,
  name: string,
  unpackedAt: number | null,
  updatedAt = 500,
): ServerChanges['items'][number] => ({
  id,
  moveId: 'srv1',
  boxId,
  name,
  qty: 1,
  valueCents: 0,
  markerIds: [],
  photoIds: [],
  unpackedAt,
  updatedAt,
});

describe('setItemUnpacked', () => {
  it('stamps the item locally and enqueues an intent-based mutation', () => {
    const { store, boxId, a } = sharedBox();
    store.getState().setItemUnpacked(boxId, a, true);
    const item = itemsOf(store, boxId).find((it) => it.id === a);
    expect(typeof item?.unpackedAt).toBe('number');
    expect(store.getState().outbox).toHaveLength(1);
    expect(store.getState().outbox[0]).toMatchObject({
      type: 'setItemUnpacked',
      payload: { id: a, boxId, on: true },
    });
  });

  it('clears the stamp when turned off and leaves the box status alone', () => {
    const { store, boxId, a } = sharedBox();
    store.getState().setItemUnpacked(boxId, a, true);
    store.getState().setItemUnpacked(boxId, a, false);
    expect(itemsOf(store, boxId).find((it) => it.id === a)?.unpackedAt).toBeNull();
    expect(store.getState().boxes[0].status).toBe(STATUS_ID.sealed);
  });

  it('flips the box to Unpacked when the last item is ticked, and only then', () => {
    const { store, boxId, a, b } = sharedBox();
    store.getState().setItemUnpacked(boxId, a, true);
    expect(store.getState().boxes[0].status).toBe(STATUS_ID.sealed);
    store.getState().setItemUnpacked(boxId, b, true);
    expect(store.getState().boxes[0].status).toBe(STATUS_ID.unpacked);
    expect(store.getState().outbox.map((m) => m.type)).toEqual([
      'setItemUnpacked',
      'setItemUnpacked',
      'setBoxStatus',
    ]);
  });

  it('does not re-send the status when the box is already Unpacked', () => {
    const { store, boxId, a, b } = sharedBox();
    store.getState().setBoxStatus(boxId, STATUS_ID.unpacked);
    store.getState().setItemUnpacked(boxId, a, true);
    store.getState().setItemUnpacked(boxId, b, true);
    expect(store.getState().outbox.filter((m) => m.type === 'setBoxStatus')).toHaveLength(1);
  });

  it('un-ticking after the flip is forward-only: the status stays Unpacked', () => {
    const { store, boxId, a, b } = sharedBox();
    store.getState().setItemUnpacked(boxId, a, true);
    store.getState().setItemUnpacked(boxId, b, true);
    store.getState().setItemUnpacked(boxId, a, false);
    expect(store.getState().boxes[0].status).toBe(STATUS_ID.unpacked);
  });
});

describe('setItemUnpacked and the delta merge', () => {
  it('a pending tick survives a pull that carries the stale row, and holds the cursor back', () => {
    const { store, boxId, a } = sharedBox();
    store.getState().setItemUnpacked(boxId, a, true);
    store.getState().applyChanges(delta(store, [serverItem(a, boxId, 'Skillet', null, 500)], 1000));
    expect(typeof itemsOf(store, boxId).find((it) => it.id === a)?.unpackedAt).toBe('number');
    expect(store.getState().lastSyncTs).toBe(499);
  });

  it('a delta that completes the set flips the box for an editor', () => {
    const { store, boxId, a, b } = sharedBox();
    store.getState().setItemUnpacked(boxId, a, true);
    store.getState().clearOutbox(store.getState().outbox.map((m) => m.clientId));
    store.getState().applyChanges(delta(store, [serverItem(b, boxId, 'Kettle', 999)]));
    expect(store.getState().boxes[0].status).toBe(STATUS_ID.unpacked);
    expect(store.getState().outbox.map((m) => m.type)).toEqual(['setBoxStatus']);
  });

  it('a delta that leaves something un-ticked does not flip', () => {
    const { store, boxId, a } = sharedBox();
    store.getState().applyChanges(delta(store, [serverItem(a, boxId, 'Skillet', 999)]));
    expect(store.getState().boxes[0].status).toBe(STATUS_ID.sealed);
    expect(store.getState().outbox).toEqual([]);
  });
});

describe('deleteItem and moveItem', () => {
  it('removing the last un-ticked item flips the box, but emptying a box does not', () => {
    const { store, boxId, a, b } = sharedBox();
    store.getState().setItemUnpacked(boxId, a, true);
    store.getState().deleteItem(boxId, b);
    expect(store.getState().boxes[0].status).toBe(STATUS_ID.unpacked);

    const roomId = store.getState().rooms[0].id;
    const lone = store.getState().addBox({ name: 'Lone', color: 'teal', roomId });
    const only = store.getState().addItem(lone, { name: 'Vase' });
    store.getState().deleteItem(lone, only);
    expect(store.getState().boxes.find((x) => x.id === lone)?.status).toBe(STATUS_ID.packing);
  });

  it('moving the last un-ticked item out flips the source box', () => {
    const { store, boxId, a, b } = sharedBox();
    const roomId = store.getState().rooms[0].id;
    const other = store.getState().addBox({ name: 'Other', color: 'teal', roomId });
    store.getState().setItemUnpacked(boxId, a, true);
    store.getState().moveItem(boxId, other, b);
    expect(store.getState().boxes.find((x) => x.id === boxId)?.status).toBe(STATUS_ID.unpacked);
    expect(store.getState().boxes.find((x) => x.id === other)?.status).toBe(STATUS_ID.packing);
  });
});

describe('viewer', () => {
  it('never flips a box from a delta', () => {
    const store = createAppStore(memoryStorage());
    store.getState().setSession('tok', { id: 'u1', name: 'Me', email: null, entitlementActive: false });
    const snap: ServerSnapshot = {
      move: { id: 'srv1', name: 'M', ownerId: 'u2', updatedAt: 1 },
      members: [
        { id: 'm1', moveId: 'srv1', userId: 'u1', role: 'viewer', name: 'Me' },
        { id: 'm2', moveId: 'srv1', userId: 'u2', role: 'owner', name: 'Owner' },
      ],
      rooms: [{ id: 'r1', moveId: 'srv1', name: 'K', icon: 'box', color: 'slate', updatedAt: 1 }],
      statuses: [
        { id: 'sealed', moveId: 'srv1', label: 'Sealed', color: 'green', custom: false, updatedAt: 1 },
        { id: 'unpacked', moveId: 'srv1', label: 'Unpacked', color: 'slate', custom: false, updatedAt: 1 },
      ],
      markers: [],
      boxes: [
        {
          id: 'b1',
          moveId: 'srv1',
          roomId: 'r1',
          number: 1,
          name: 'B',
          color: 'amber',
          statusId: 'sealed',
          markerIds: [],
          updatedAt: 1,
        },
      ],
      items: [serverItem('i1', 'b1', 'Skillet', 5, 1)],
    };
    store.getState().addSharedMoveFromSnapshot('srv1', snap);
    store.getState().applyChanges(delta(store, [serverItem('i1', 'b1', 'Skillet', 999)]));
    expect(store.getState().boxes[0].status).toBe('sealed');
    expect(store.getState().outbox).toEqual([]);
  });
});

describe('unpackBox', () => {
  it('ticks every remaining item once and sets the status', () => {
    const { store, boxId, a, b } = sharedBox();
    store.getState().setItemUnpacked(boxId, a, true);
    store.getState().unpackBox(boxId);
    expect(itemsOf(store, boxId).every((it) => it.unpackedAt != null)).toBe(true);
    expect(store.getState().boxes[0].status).toBe(STATUS_ID.unpacked);
    const types = store.getState().outbox.map((m) => m.type);
    expect(types).toEqual(['setItemUnpacked', 'setItemUnpacked', 'setBoxStatus']);
    expect(store.getState().outbox[1].payload).toMatchObject({ id: b, on: true });
  });

  it('closes out an empty box with just the status change', () => {
    const { store } = sharedBox();
    const emptyBox = store
      .getState()
      .addBox({ name: 'Empty', color: 'teal', roomId: store.getState().rooms[0].id });
    store.getState().clearOutbox(store.getState().outbox.map((m) => m.clientId));
    store.getState().unpackBox(emptyBox);
    expect(store.getState().boxes.find((b) => b.id === emptyBox)?.status).toBe(STATUS_ID.unpacked);
    expect(store.getState().outbox.map((m) => m.type)).toEqual(['setBoxStatus']);
  });
});

describe('unpackProgress', () => {
  it('counts ticked items over the total, and 0/0 for an unknown box', () => {
    const { store, boxId, a } = sharedBox();
    expect(unpackProgress(store.getState(), boxId)).toEqual({ done: 0, total: 2 });
    store.getState().setItemUnpacked(boxId, a, true);
    expect(unpackProgress(store.getState(), boxId)).toEqual({ done: 1, total: 2 });
    expect(unpackProgress(store.getState(), 'nope')).toEqual({ done: 0, total: 0 });
  });
});

describe('snapshot mapping', () => {
  it('carries unpackedAt from the server item into the client item', () => {
    const store = createAppStore(memoryStorage());
    store.getState().setSession('tok', { id: 'u1', name: 'Me', email: null, entitlementActive: false });
    const snap: ServerSnapshot = {
      move: { id: 'srv1', name: 'M', ownerId: 'u1', updatedAt: 1 },
      members: [{ id: 'm1', moveId: 'srv1', userId: 'u1', role: 'owner', name: 'Me' }],
      rooms: [{ id: 'r1', moveId: 'srv1', name: 'K', icon: 'box', color: 'slate', updatedAt: 1 }],
      statuses: [
        { id: 'packing', moveId: 'srv1', label: 'Packing', color: 'amber', custom: false, updatedAt: 1 },
      ],
      markers: [],
      boxes: [
        {
          id: 'b1',
          moveId: 'srv1',
          roomId: 'r1',
          number: 1,
          name: 'B',
          color: 'amber',
          statusId: 'packing',
          markerIds: [],
          updatedAt: 1,
        },
      ],
      items: [
        {
          id: 'i1',
          moveId: 'srv1',
          boxId: 'b1',
          name: 'Skillet',
          qty: 1,
          valueCents: 0,
          markerIds: [],
          photoIds: [],
          unpackedAt: 1234,
          updatedAt: 1,
        },
        {
          id: 'i2',
          moveId: 'srv1',
          boxId: 'b1',
          name: 'Kettle',
          qty: 1,
          valueCents: 0,
          markerIds: [],
          photoIds: [],
          updatedAt: 1,
        },
      ],
    };
    store.getState().addSharedMoveFromSnapshot('srv1', snap);
    const items = store.getState().itemsByBox.b1;
    expect(items.map((it) => it.unpackedAt ?? null)).toEqual([1234, null]);
  });
});
