import { describe, expect, it } from 'vitest';

import { countOf, plural } from './text';

describe('plural', () => {
  it('keeps the singular for exactly one', () => {
    expect(plural(1, 'item')).toBe('item');
  });
  it('adds -s, or -es after an x', () => {
    expect(plural(2, 'item')).toBe('items');
    expect(plural(0, 'box')).toBe('boxes');
  });
});

describe('countOf', () => {
  it('prefixes the count', () => {
    expect(countOf(1, 'box')).toBe('1 box');
    expect(countOf(3, 'box')).toBe('3 boxes');
  });
});
