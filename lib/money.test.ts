import { describe, expect, it } from 'vitest';

import { money } from './money';

describe('money', () => {
  it('formats whole dollars with thousands grouping', () => {
    expect(money(0)).toBe('$0');
    expect(money(999)).toBe('$999');
    expect(money(1000)).toBe('$1,000');
    expect(money(1234567.49)).toBe('$1,234,567');
  });

  it('rounds to the nearest dollar', () => {
    expect(money(12.5)).toBe('$13');
    expect(money(12.49)).toBe('$12');
  });

  it('treats missing values as zero', () => {
    expect(money(undefined)).toBe('$0');
    expect(money(null)).toBe('$0');
    expect(money(Number.NaN)).toBe('$0');
  });
});
