import { beforeEach, describe, expect, it } from 'vitest';

import { STATUS_ID } from '@/data/defaults';

import { createAppStore } from './createStore';
import { allIndexedItems, searchMove } from './selectors';
import type { State } from './types';

/** Synchronous in-memory storage so the store hydrates before the first read. */
const memoryStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

/** A two-room move: kitchen box sealed, living-room box in transit, plus an empty packing box. */
function seed() {
  const store = createAppStore(memoryStorage());
  const s = store.getState();
  const kitchen = s.addRoom({ name: 'Kitchen' });
  const living = s.addRoom({ name: 'Living room' });
  const pans = s.addBox({ name: 'Pans and knives', color: 'amber', roomId: kitchen });
  const media = s.addBox({ name: 'TV bits', color: 'sky', roomId: living });
  const empty = s.addBox({ name: 'Cushions', color: 'teal', roomId: living });
  s.addItem(pans, { name: 'Skillet' });
  s.addItem(pans, { name: 'Bread knives', markers: ['mk_fragile'] });
  s.addItem(media, { name: 'Remote', note: 'for the Christmas lights too' });
  s.addItem(media, { name: 'Speaker', markers: ['mk_fragile'] });
  s.setBoxStatus(pans, STATUS_ID.sealed);
  s.setBoxStatus(media, STATUS_ID.transit);
  return { store, kitchen, living, pans, media, empty };
}

const names = (hits: { name: string }[]) => hits.map((h) => h.name);

describe('allIndexedItems', () => {
  it('carries the owning box status on each item', () => {
    const { store, pans } = seed();
    const indexed = allIndexedItems(store.getState());
    const skillet = indexed.find((it) => it.name === 'Skillet');
    expect(skillet?.boxStatus).toBe(STATUS_ID.sealed);
    expect(skillet?.boxName).toBe('Pans and knives');
    expect(store.getState().boxes.find((b) => b.id === pans)?.status).toBe(STATUS_ID.sealed);
  });
});

describe('searchMove', () => {
  let state: State;
  let ctx: ReturnType<typeof seed>;
  beforeEach(() => {
    ctx = seed();
    state = ctx.store.getState();
  });
  const run = (query: string, filters?: Parameters<typeof searchMove>[3]) =>
    searchMove(state, allIndexedItems(state), query, filters);

  it('returns nothing for a blank query with no filters', () => {
    expect(run('')).toEqual({ items: [], boxes: [] });
  });

  it('finds items by fuzzy name, synonym, marker and note, and boxes by name', () => {
    // Singular query, plural item name; Skillet trails because "knives" is only in its box name.
    expect(names(run('knife').items)).toEqual(['Bread knives', 'Skillet']);
    expect(names(run('xmas').items)).toEqual(['Remote']);
    expect(run('xmas').items[0].matchedOn).toEqual(['note']);
    expect(names(run('fragile').items)).toEqual(['Bread knives', 'Speaker']);
    expect(names(run('skilet').items)).toEqual(['Skillet']);
    expect(names(run('cushion').boxes)).toEqual(['Cushions']);
  });

  it('ranks a name hit above a box-name hit for the same word', () => {
    // "knives" is in the item name "Bread knives" and the box name "Pans and knives".
    const { items } = run('knives');
    expect(names(items)).toEqual(['Bread knives', 'Skillet']);
    expect(items[0].matchedOn).toEqual(['name']);
    expect(items[1].matchedOn).toEqual(['box']);
  });

  it('matches items and boxes by room name', () => {
    expect(names(run('living').items)).toEqual(['Remote', 'Speaker']);
    expect(names(run('living').boxes)).toEqual(['TV bits', 'Cushions']);
  });

  it('narrows a query by room and by status', () => {
    expect(names(run('fragile', { roomId: ctx.living }).items)).toEqual(['Speaker']);
    expect(names(run('fragile', { statusId: STATUS_ID.sealed }).items)).toEqual(['Bread knives']);
    expect(names(run('fragile', { roomId: ctx.kitchen, statusId: STATUS_ID.transit }).items)).toEqual([]);
  });

  it('lists the whole filtered set when the query is blank but a filter is on', () => {
    const inTransit = run('', { statusId: STATUS_ID.transit });
    expect(names(inTransit.items)).toEqual(['Remote', 'Speaker']);
    expect(names(inTransit.boxes)).toEqual(['TV bits']);
    const living = run('', { roomId: ctx.living });
    expect(names(living.boxes)).toEqual(['TV bits', 'Cushions']);
    expect(living.items.every((it) => it.matchedOn.length === 0)).toBe(true);
  });

  it('treats null filter values as unset', () => {
    expect(run('', { roomId: null, statusId: null })).toEqual({ items: [], boxes: [] });
  });
});
