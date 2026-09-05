import { describe, expect, it } from 'vitest';

import { normalize, searchDocs, stem, tokenize, type Field } from './search';

describe('normalize', () => {
  it('lowercases, strips accents and punctuation, collapses whitespace', () => {
    expect(normalize('  Café  Crème-Brûlée! ')).toBe('cafe creme brulee');
    expect(normalize("Grandma's TV")).toBe('grandma s tv');
  });
});

describe('stem', () => {
  it('drops regular plurals', () => {
    expect(stem('lamps')).toBe('lamp');
    expect(stem('boxes')).toBe('box');
    expect(stem('dishes')).toBe('dish');
    expect(stem('glasses')).toBe('glass');
    expect(stem('batteries')).toBe('battery');
  });
  it('handles common irregulars and leaves short or singular words alone', () => {
    expect(stem('knives')).toBe('knife');
    expect(stem('shelves')).toBe('shelf');
    expect(stem('glass')).toBe('glass');
    expect(stem('bus')).toBe('bus');
    expect(stem('tv')).toBe('tv');
  });
});

describe('tokenize', () => {
  it('splits on whitespace after normalizing and stems each token', () => {
    expect(tokenize('Two  Christmas Lamps')).toEqual(['two', 'christmas', 'lamp']);
    expect(tokenize('   ')).toEqual([]);
  });
});

type Doc = { id: string; name: string; note?: string; markers?: string[]; box?: string; room?: string };
const fieldsOf = (d: Doc): Field<'name' | 'note' | 'marker' | 'box' | 'room'>[] => [
  { kind: 'name', text: d.name, weight: 3 },
  ...(d.markers ?? []).map((m) => ({ kind: 'marker' as const, text: m, weight: 2 })),
  { kind: 'note', text: d.note ?? '', weight: 1.5 },
  { kind: 'box', text: d.box ?? '', weight: 1.5 },
  { kind: 'room', text: d.room ?? '', weight: 1 },
];
const ids = (hits: { doc: Doc }[]): string[] => hits.map((h) => h.doc.id);

const docs: Doc[] = [
  { id: 'lamp', name: 'Desk lamp', box: 'Office bits', room: 'Office' },
  { id: 'lights', name: 'Christmas lights', note: 'in the red tin', box: 'Seasonal', room: 'Garage' },
  { id: 'tv', name: 'Television', markers: ['Fragile'], box: 'Living room electronics', room: 'Living room' },
  { id: 'sofa', name: 'Couch cushions', box: 'Soft stuff', room: 'Living room' },
  { id: 'knives', name: 'Kitchen knives', markers: ['Fragile'], box: 'Sharp things', room: 'Kitchen' },
  {
    id: 'cables',
    name: 'Cables',
    note: 'HDMI and the TV remote',
    box: 'Living room electronics',
    room: 'Living room',
  },
];

describe('searchDocs', () => {
  it('returns nothing for a blank query', () => {
    expect(searchDocs('  ', docs, fieldsOf)).toEqual([]);
  });

  it('matches case-insensitively on any token, singular or plural', () => {
    expect(ids(searchDocs('LAMP', docs, fieldsOf))).toEqual(['lamp']);
    expect(ids(searchDocs('knife', docs, fieldsOf))).toEqual(['knives']);
    expect(ids(searchDocs('light', docs, fieldsOf))).toEqual(['lights']);
  });

  it('matches as you type (prefix)', () => {
    expect(ids(searchDocs('chri', docs, fieldsOf))).toEqual(['lights']);
  });

  it('matches through household synonyms', () => {
    expect(ids(searchDocs('xmas lights', docs, fieldsOf))).toEqual(['lights']);
    expect(ids(searchDocs('sofa', docs, fieldsOf))).toEqual(['sofa']);
  });

  it('tolerates one typo in a longer word but not in a short one', () => {
    expect(ids(searchDocs('lmap', docs, fieldsOf))).toEqual(['lamp']);
    expect(ids(searchDocs('knifes', docs, fieldsOf))).toEqual(['knives']);
    expect(ids(searchDocs('pan', docs, fieldsOf))).toEqual([]);
  });

  it('requires every token to match somewhere (AND), across fields', () => {
    expect(ids(searchDocs('kitchen knife', docs, fieldsOf))).toEqual(['knives']);
    expect(ids(searchDocs('kitchen lamp', docs, fieldsOf))).toEqual([]);
  });

  it('searches notes and markers and reports which fields matched', () => {
    const hits = searchDocs('red tin', docs, fieldsOf);
    expect(ids(hits)).toEqual(['lights']);
    expect(hits[0].matched).toEqual(['note']);

    const fragile = searchDocs('fragile', docs, fieldsOf);
    expect(ids(fragile)).toEqual(['tv', 'knives']);
    expect(fragile[0].matched).toEqual(['marker']);
  });

  it('ranks a name hit above a note or room hit, and ties keep input order', () => {
    // "tv": Television via synonym in the name; Cables via the note.
    expect(ids(searchDocs('tv', docs, fieldsOf))).toEqual(['tv', 'cables']);
    // "living room": three docs match via box/room; the two with it in the box name rank first, in input order.
    expect(ids(searchDocs('living room', docs, fieldsOf))).toEqual(['tv', 'cables', 'sofa']);
  });

  it('ignores empty fields', () => {
    expect(ids(searchDocs('undefined', docs, fieldsOf))).toEqual([]);
  });
});
