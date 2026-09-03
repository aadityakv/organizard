import { describe, expect, it } from 'vitest';

import { buildMigrationBatch } from './migration';
import type { SliceData } from '@/store/library';

const slice = (over: Partial<SliceData> = {}): SliceData => ({
  move: { name: 'Apartment move', from: 'Austin', to: 'Boston', target: '' },
  rooms: [{ id: 'r1', name: 'Kitchen', dest: null, icon: 'utensils', color: 'amber' }],
  boxes: [
    {
      id: 'b1',
      number: 1,
      name: 'Pots and pans',
      color: 'coral',
      roomId: 'r1',
      status: 'packing',
      markers: ['mk_fragile'],
      cover: null,
    },
  ],
  statuses: [{ id: 'packing', label: 'Packing', color: 'green', custom: false }],
  markers: [{ id: 'mk_fragile', label: 'Fragile', color: 'red', icon: 'wine', custom: false }],
  members: [],
  itemsByBox: {
    b1: [
      {
        id: 'i1',
        boxId: 'b1',
        name: 'Cast iron skillet',
        qty: 2,
        value: 80,
        note: 'heavy',
        markers: ['mk_fragile'],
        photos: [],
      },
    ],
  },
  activeMode: 'local',
  serverMoveId: null,
  outbox: [],
  lastSyncTs: 0,
  ...over,
});

describe('buildMigrationBatch', () => {
  it('replays every entity, parents before children', () => {
    const batch = buildMigrationBatch(slice());
    expect(batch.map((m) => m.type)).toEqual([
      'addStatus',
      'addMarker',
      'addRoom',
      'addBox',
      'setBoxMarker',
      'addItem',
    ]);
  });

  it('keeps client ids stable per row and maps cents/join fields', () => {
    const batch = buildMigrationBatch(slice());
    const item = batch.find((m) => m.type === 'addItem');
    expect(item && 'payload' in item && item.payload).toMatchObject({
      id: 'i1',
      boxId: 'b1',
      valueCents: 8000,
      note: 'heavy',
      markerIds: ['mk_fragile'],
      photoIds: [],
    });
    const box = batch.find((m) => m.type === 'addBox');
    expect(box && 'payload' in box && box.payload).toMatchObject({ id: 'b1', statusId: 'packing' });
    // every clientId is unique (the server dedupes by clientId on retry)
    const ids = new Set(batch.map((m) => m.clientId));
    expect(ids.size).toBe(batch.length);
  });

  it('handles an empty move and missing optional fields', () => {
    const empty = slice({
      rooms: [],
      boxes: [],
      itemsByBox: {},
      statuses: [],
      markers: [],
    });
    expect(buildMigrationBatch(empty)).toEqual([]);
    const sparse = slice({
      boxes: [
        {
          id: 'b2',
          number: 2,
          name: 'Misc',
          color: 'slate',
          roomId: 'r1',
          status: 'packing',
          markers: [],
          cover: null,
        },
      ],
      itemsByBox: { b2: [{ id: 'i2', boxId: 'b2', name: 'Cables', qty: 1, value: 0 }] },
    });
    const batch = buildMigrationBatch(sparse);
    const item = batch.find((m) => m.type === 'addItem');
    expect(item && 'payload' in item && item.payload).toMatchObject({
      valueCents: 0,
      note: null,
      icon: null,
      markerIds: [],
    });
  });
});
