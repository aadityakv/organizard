import { describe, expect, it } from 'vitest';

import { iconFor, parseList, parseUtterance, wordNum } from './streamParse';

describe('wordNum', () => {
  it('parses spelled-out numbers', () => {
    expect(wordNum('forty')).toBe(40);
    expect(wordNum('fifty four')).toBe(54);
    expect(wordNum('one hundred forty')).toBe(140);
    expect(wordNum('two hundred twenty')).toBe(220);
    expect(wordNum('two hundred')).toBe(200);
  });
  it('returns null for non-numbers', () => {
    expect(wordNum('skillet')).toBeNull();
    expect(wordNum('about')).toBeNull();
  });
});

describe('parseUtterance — the design sample phrases', () => {
  const cases: [string, { name: string; qty: number | null; value: number | null }][] = [
    ['stand mixer, two hundred twenty dollars', { name: 'Stand mixer', qty: null, value: 220 }],
    ['stoneware mugs, six of them, fifty four dollars', { name: 'Stoneware mugs', qty: 6, value: 54 }],
    ['cast iron skillet, eighty bucks', { name: 'Cast iron skillet', qty: null, value: 80 }],
    ['chef knife set, one hundred forty dollars', { name: 'Chef knife set', qty: null, value: 140 }],
    ['table lamp, twenty five dollars', { name: 'Table lamp', qty: null, value: 25 }],
    ['wool coats, three of them, two hundred dollars', { name: 'Wool coats', qty: 3, value: 200 }],
  ];
  for (const [input, expected] of cases) {
    it(input, () => expect(parseUtterance(input)).toEqual(expected));
  }

  it('is order-independent and ignores filler ("about fifty bucks, six of them, stoneware mugs")', () => {
    expect(parseUtterance('about fifty bucks, six of them, stoneware mugs')).toEqual({
      name: 'Stoneware mugs',
      qty: 6,
      value: 50,
    });
  });

  it('handles a $ value and a leading quantity', () => {
    expect(parseUtterance('$96 dinner plates')).toEqual({ name: 'Dinner plates', qty: null, value: 96 });
    expect(parseUtterance('three coffee mugs')).toEqual({ name: 'Coffee mugs', qty: 3, value: null });
    expect(parseUtterance('blender x2, forty dollars')).toEqual({ name: 'Blender', qty: 2, value: 40 });
  });

  it('leaves qty/value null when not spoken', () => {
    expect(parseUtterance('turntable')).toEqual({ name: 'Turntable', qty: null, value: null });
  });
});

describe('parseList — voice-only "talk a whole box in"', () => {
  it('splits one utterance into multiple items', () => {
    const items = parseList('paperbacks, a desk lamp, three coffee mugs, and a phone charger');
    expect(items.map((i) => i.name)).toEqual(['Paperbacks', 'Desk lamp', 'Coffee mugs', 'Phone charger']);
    expect(items[2].qty).toBe(3);
  });
  it('splits on "and"/commas and parses per-item values', () => {
    const items = parseList('dinner plates, six wine glasses, a salad bowl');
    expect(items).toHaveLength(3);
    expect(items[1]).toEqual({ name: 'Wine glasses', qty: 6, value: null });
  });
});

describe('iconFor', () => {
  it('maps names to category icons, falling back to package', () => {
    expect(iconFor('Stoneware mugs')).toBe('coffee');
    expect(iconFor('Cast iron skillet')).toBe('cooking-pot');
    expect(iconFor('Vinyl records')).toBe('disc-3');
    expect(iconFor('Wool coats')).toBe('shirt');
    expect(iconFor('Something unknown')).toBe('package');
  });
});
