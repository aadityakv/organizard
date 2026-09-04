import { describe, expect, it } from 'vitest';
import type { StateStorage } from 'zustand/middleware';

import type { ServerChanges, ServerSnapshot } from '@/lib/api';
import type { Box as WireBox, Item as WireItem, Room as WireRoom } from '@/shared';

import { createAppStore } from './createStore';
import { migrate, STORE_KEY } from './persist';
import { moveSummaries } from './selectors';

/** Synchronous in-memory storage: the store hydrates before the first read. */
function memoryStorage(seed: Record<string, string> = {}): StateStorage & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const wireRoom = (over: Partial<WireRoom> = {}): WireRoom => ({
  id: 'r1',
  moveId: 'srv1',
  name: 'Kitchen',
  dest: null,
  icon: 'utensils',
  color: 'amber',
  updatedAt: 100,
  ...over,
});

const wireBox = (over: Partial<WireBox> = {}): WireBox => ({
  id: 'b1',
  moveId: 'srv1',
  roomId: 'r1',
  number: 1,
  name: 'Pans',
  color: 'amber',
  statusId: 'packing',
  coverPhotoId: null,
  markerIds: [],
  updatedAt: 100,
  ...over,
});

const wireItem = (over: Partial<WireItem> = {}): WireItem => ({
  id: 'i1',
  moveId: 'srv1',
  boxId: 'b1',
  name: 'Skillet',
  qty: 1,
  valueCents: 4500,
  note: null,
  icon: null,
  markerIds: [],
  photoIds: ['ph_1'],
  updatedAt: 100,
  ...over,
});

const snapshot = (over: Partial<ServerSnapshot> = {}): ServerSnapshot => ({
  move: {
    id: 'srv1',
    name: 'Shared move',
    from: 'A',
    to: 'B',
    targetDate: null,
    ownerId: 'u1',
    updatedAt: 1,
  },
  members: [{ id: 'm1', moveId: 'srv1', userId: 'u1', role: 'owner', name: 'Me' }],
  rooms: [wireRoom()],
  statuses: [],
  markers: [],
  boxes: [wireBox()],
  items: [wireItem()],
  ...over,
});

const changes = (over: Partial<ServerChanges> = {}): ServerChanges => ({
  serverTime: 500,
  cursor: 500,
  hasMore: false,
  rooms: [],
  statuses: [],
  markers: [],
  boxes: [],
  items: [],
  members: [],
  ...over,
});

/** A store with one shared move open and a session. */
function sharedStore() {
  const store = createAppStore(memoryStorage());
  store.getState().setSession('tok', { id: 'u1', name: 'Me', email: null });
  store.getState().addSharedMoveFromSnapshot('srv1', snapshot());
  return store;
}

describe('inventory actions', () => {
  it('a local move never touches the outbox', () => {
    const store = createAppStore(memoryStorage());
    store.getState().createMove({ name: 'Local' });
    const roomId = store.getState().addRoom({ name: 'Garage' });
    const boxId = store.getState().addBox({ name: 'Tools', color: 'slate', roomId });
    store.getState().addItem(boxId, { name: 'Drill', value: 120 });

    const s = store.getState();
    expect(s.boxes).toHaveLength(1);
    expect(s.boxes[0].number).toBe(1);
    expect(s.itemsByBox[boxId]).toHaveLength(1);
    expect(s.outbox).toEqual([]);
  });

  it('a shared move enqueues one mutation per write, with the server payload shape', () => {
    const store = sharedStore();
    const boxId = store.getState().addBox({ name: 'Books', color: 'indigo', roomId: 'r1' });
    store.getState().addItem(boxId, { name: 'Novel', value: 12.5, qty: 2 });

    const [addBox, addItem] = store.getState().outbox;
    expect(addBox.type).toBe('addBox');
    expect(addBox.payload).toMatchObject({ id: boxId, roomId: 'r1', number: 2, statusId: 'packing' });
    expect(addItem.type).toBe('addItem');
    expect(addItem.payload).toMatchObject({ boxId, name: 'Novel', qty: 2, valueCents: 1250, photoIds: [] });
    expect(addBox.clientId).not.toBe(addItem.clientId);
  });

  it('deleting a room cascades to its boxes and items, boxes first in the outbox', () => {
    const store = sharedStore();
    store.getState().deleteRoom('r1');

    const s = store.getState();
    expect(s.rooms).toEqual([]);
    expect(s.boxes).toEqual([]);
    expect(s.itemsByBox.b1).toBeUndefined();
    expect(s.outbox.map((m) => m.type)).toEqual(['deleteBox', 'deleteRoom']);
  });

  it('a local cover photo is not synced until it has been uploaded', () => {
    const store = sharedStore();
    store.getState().setBoxCover('b1', 'file:///tmp/cover.jpg');
    expect(store.getState().outbox).toEqual([]);
    expect(store.getState().boxes[0].cover).toBe('file:///tmp/cover.jpg');

    store.getState().setBoxCover('b1', 'ph_9');
    expect(store.getState().outbox[0]).toMatchObject({
      type: 'setBoxCover',
      payload: { id: 'b1', coverPhotoId: 'ph_9' },
    });
  });

  it('toggling a marker sends the desired end state', () => {
    const store = sharedStore();
    store.getState().toggleBoxMarker('b1', 'mk_fragile');
    store.getState().toggleBoxMarker('b1', 'mk_fragile');
    expect(store.getState().outbox.map((m) => m.payload)).toEqual([
      { boxId: 'b1', markerId: 'mk_fragile', on: true },
      { boxId: 'b1', markerId: 'mk_fragile', on: false },
    ]);
    expect(store.getState().boxes[0].markers).toEqual([]);
  });
});

describe('applyChanges', () => {
  it('applies server edits, tombstones and the cursor', () => {
    const store = sharedStore();
    store.getState().applyChanges(
      changes({
        rooms: [wireRoom({ name: 'Kitchen (renamed)', updatedAt: 400 })],
        items: [wireItem({ deletedAt: 450, updatedAt: 450 })],
      }),
    );
    const s = store.getState();
    expect(s.rooms[0].name).toBe('Kitchen (renamed)');
    expect(s.itemsByBox.b1).toEqual([]);
    expect(s.lastSyncTs).toBe(500);
  });

  it('keeps a locally edited row and holds the cursor back so it re-arrives', () => {
    const store = sharedStore();
    store.getState().updateBox('b1', { name: 'Pans (mine)' }); // now dirty in the outbox
    store.getState().applyChanges(changes({ boxes: [wireBox({ name: 'Pans (theirs)', updatedAt: 420 })] }));

    const s = store.getState();
    expect(s.boxes[0].name).toBe('Pans (mine)');
    expect(s.lastSyncTs).toBe(419);
  });

  it('preserves not-yet-uploaded local photos on an item the server just updated', () => {
    const store = sharedStore();
    store.getState().swapItemPhoto('b1', 'i1', 'ph_1', 'file:///tmp/new.jpg'); // simulate a fresh capture
    store
      .getState()
      .applyChanges(changes({ items: [wireItem({ photoIds: ['ph_1', 'ph_2'], updatedAt: 450 })] }));

    expect(store.getState().itemsByBox.b1[0].photos).toEqual(['ph_1', 'ph_2', 'file:///tmp/new.jpg']);
  });
});

describe('library', () => {
  it('switching moves parks live edits into the bundle and restores them on return', () => {
    const store = createAppStore(memoryStorage());
    const a = store.getState().createMove({ name: 'A' });
    store.getState().addRoom({ name: 'Attic' });
    const b = store.getState().createMove({ name: 'B' });
    expect(store.getState().rooms).toEqual([]);
    expect(store.getState().library[a].rooms).toHaveLength(1);

    store.getState().switchMove(a);
    expect(store.getState().currentMoveId).toBe(a);
    expect(store.getState().rooms[0].name).toBe('Attic');
    expect(store.getState().library[b].move.name).toBe('B');
  });

  it('summarises the open move from the live slice, not its stale bundle', () => {
    const store = createAppStore(memoryStorage());
    const id = store.getState().createMove({ name: 'Live' });
    const roomId = store.getState().addRoom({ name: 'Hall' });
    store.getState().addBox({ name: 'Coats', color: 'teal', roomId });

    const [summary] = moveSummaries(store.getState());
    expect(summary.id).toBe(id);
    expect(summary.boxCount).toBe(1);
    expect(store.getState().library[id].boxes).toHaveLength(0); // the bundle is stale by design
  });

  it('importing a shared move twice by server id is a no-op', () => {
    const store = createAppStore(memoryStorage());
    store.getState().importSharedMove('srv1', snapshot());
    store.getState().importSharedMove('srv1', snapshot());
    expect(Object.keys(store.getState().library)).toHaveLength(1);
    expect(store.getState().currentMoveId).toBeNull(); // import does not open the move
  });
});

describe('signOut', () => {
  it('drops synced moves, keeps local ones, and returns to the guest state', () => {
    const store = createAppStore(memoryStorage());
    const local = store.getState().createMove({ name: 'Guest move' });
    store.getState().setSession('tok', { id: 'u1', name: 'Me', email: null });
    store.getState().startProTrial();
    store.getState().setOnboarded(true);
    store.getState().addSharedMoveFromSnapshot('srv1', snapshot()); // now open

    store.getState().signOut();

    const s = store.getState();
    expect(s.session).toBeNull();
    expect(s.account).toBeNull();
    expect(s.proTrialUntil).toBeNull();
    expect(s.onboarded).toBe(false);
    expect(Object.keys(s.library)).toEqual([local]);
    expect(s.currentMoveId).toBeNull(); // the open move was synced, so the live slice is empty
    expect(s.boxes).toEqual([]);
  });
});

describe('persistence', () => {
  it('survives a relaunch through the injected storage, without the session token', () => {
    const storage = memoryStorage();
    const first = createAppStore(storage);
    first.getState().setSession('secret', { id: 'u1', name: 'Me', email: null });
    const id = first.getState().createMove({ name: 'Persisted' });

    expect(storage.data[STORE_KEY]).not.toContain('secret');

    const second = createAppStore(storage);
    expect(second.getState().currentMoveId).toBe(id);
    expect(second.getState().move.name).toBe('Persisted');
    expect(second.getState().session).toBeNull();
    expect(second.getState().account?.id).toBe('u1');
  });

  it('migrates a v2 shared move into a one-entry library and drops unknown outbox entries', () => {
    const migrated = migrate(
      {
        activeMode: 'shared',
        serverMoveId: 'srv1',
        move: { name: 'Old', from: '', to: '', target: '' },
        boxes: [],
        outbox: [
          { type: 'toggleBoxMarker', clientId: 'c1', ts: 1, payload: {} },
          { type: 'addRoom', clientId: 'c2', ts: 2, payload: { id: 'r1', name: 'X', icon: 'box' } },
        ],
      },
      2,
    );
    const [bundle] = Object.values(migrated.library);
    expect(migrated.currentMoveId).toBe(bundle.id);
    expect(bundle.serverMoveId).toBe('srv1');
    expect(bundle.outbox.map((m) => m.type)).toEqual(['addRoom']);
  });

  it('migrates a v2 local install to an empty library', () => {
    const migrated = migrate({ activeMode: 'local', boxes: [{ id: 'demo' }] }, 2);
    expect(migrated.library).toEqual({});
    expect(migrated.boxes).toEqual([]);
    expect(migrated.currentMoveId).toBeNull();
  });
});
