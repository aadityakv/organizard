import { describe, expect, it } from 'vitest';

import { toClientBox, toClientItem, toClientMember, toClientRoom } from './mappers';

describe('server → client mappers', () => {
  it('converts integer cents to dollars and keeps photo ids as-is', () => {
    const item = toClientItem({
      id: 'i1',
      moveId: 'm',
      boxId: 'b1',
      name: 'Lamp',
      qty: 2,
      valueCents: 1999,
      note: null,
      icon: null,
      markerIds: ['mk_fragile'],
      photoIds: ['ph_1'],
      updatedAt: 1,
    });
    expect(item).toEqual({
      id: 'i1',
      boxId: 'b1',
      name: 'Lamp',
      qty: 2,
      value: 19.99,
      note: undefined,
      icon: undefined,
      markers: ['mk_fragile'],
      photos: ['ph_1'],
    });
  });

  it('renames the server join fields to the client names', () => {
    const box = toClientBox({
      id: 'b1',
      moveId: 'm',
      roomId: 'r1',
      number: 3,
      name: 'Pans',
      color: 'amber',
      statusId: 'sealed',
      coverPhotoId: null,
      markerIds: [],
      updatedAt: 1,
    });
    expect(box.status).toBe('sealed');
    expect(box.cover).toBeNull();

    const room = toClientRoom({
      id: 'r1',
      moveId: 'm',
      name: 'Kitchen',
      icon: 'utensils',
      color: 'amber',
      updatedAt: 1,
    });
    expect(room.dest).toBeNull();

    const member = toClientMember({ id: 'row', moveId: 'm', userId: 'u1', role: 'editor', name: 'Sam' });
    expect(member).toEqual({ id: 'u1', name: 'Sam', role: 'editor' });
  });
});
