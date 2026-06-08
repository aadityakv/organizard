import { describe, expect, it } from 'vitest';
import { newBundle, sliceFromBundle, snapshotInto, summarize, roleFor, type MoveBundle } from './library';
import { STARTER_STATUSES, STARTER_MARKERS } from '@/data/defaults';

const emptyMove = { name: 'Test Move', from: '', to: '', target: '' };

describe('newBundle', () => {
  it('creates an empty local move with starter statuses/markers and no boxes', () => {
    const b = newBundle('mv_1', emptyMove, 1000);
    expect(b.id).toBe('mv_1');
    expect(b.archived).toBe(false);
    expect(b.createdAt).toBe(1000);
    expect(b.activeMode).toBe('local');
    expect(b.serverMoveId).toBeNull();
    expect(b.boxes).toEqual([]);
    expect(b.itemsByBox).toEqual({});
    expect(b.statuses).toEqual(STARTER_STATUSES);
    expect(b.markers).toEqual(STARTER_MARKERS);
    expect(b.outbox).toEqual([]);
  });
});

describe('sliceFromBundle / snapshotInto round-trip', () => {
  it('hydrating a slice then snapshotting it back is lossless', () => {
    const b = newBundle('mv_1', emptyMove, 1000);
    const withBox: MoveBundle = {
      ...b,
      boxes: [{ id: 'b1', number: 1, name: 'Books', color: 'amber', roomId: 'r1', status: 'packing', markers: [], cover: null }],
      rooms: [{ id: 'r1', name: 'Office', dest: null, icon: 'briefcase' }],
      itemsByBox: { b1: [{ id: 'i1', boxId: 'b1', name: 'Novel', qty: 1, value: 0 }] },
    };
    const slice = sliceFromBundle(withBox);
    const restored = snapshotInto(b, slice, 2000); // meta from b, data from slice
    expect(restored.boxes).toEqual(withBox.boxes);
    expect(restored.itemsByBox).toEqual(withBox.itemsByBox);
    expect(restored.rooms).toEqual(withBox.rooms);
    expect(restored.id).toBe('mv_1');         // meta preserved
    expect(restored.lastOpenedAt).toBe(2000); // meta updated
  });
});

describe('summarize', () => {
  it('counts boxes and items and reports mode/archived', () => {
    const b: MoveBundle = {
      ...newBundle('mv_1', emptyMove, 1000),
      boxes: [{ id: 'b1', number: 1, name: 'Books', color: 'amber', roomId: 'r1', status: 'packing', markers: [], cover: null }],
      itemsByBox: { b1: [{ id: 'i1', boxId: 'b1', name: 'Novel', qty: 2, value: 0 }] },
    };
    const s = summarize(b);
    expect(s.id).toBe('mv_1');
    expect(s.name).toBe('Test Move');
    expect(s.boxCount).toBe(1);
    expect(s.itemCount).toBe(2);  // sums qty
    expect(s.mode).toBe('local');
    expect(s.archived).toBe(false);
  });
});

describe('roleFor', () => {
  it('a local move is always owner', () => {
    expect(roleFor('local', [], 'u1')).toBe('owner');
  });
  it('a shared move uses membership role, defaulting to viewer', () => {
    const members = [{ id: 'u1', name: 'Me', role: 'editor' as const }];
    expect(roleFor('shared', members, 'u1')).toBe('editor');
    expect(roleFor('shared', members, 'u2')).toBe('viewer');
    expect(roleFor('shared', members, null)).toBe('viewer');
  });
});
