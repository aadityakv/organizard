import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../src/lib/password';

describe('password hashing', () => {
  it('verifies the correct password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(stored.startsWith('pbkdf2$')).toBe(true);
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
    expect(await verifyPassword('wrong password', stored)).toBe(false);
  });

  it('produces a unique salt per hash (same password => different stored value)', async () => {
    const a = await hashPassword('samepass123');
    const b = await hashPassword('samepass123');
    expect(a).not.toBe(b);
    expect(await verifyPassword('samepass123', a)).toBe(true);
    expect(await verifyPassword('samepass123', b)).toBe(true);
  });

  it('returns false for malformed/empty stored hashes', async () => {
    expect(await verifyPassword('x', null)).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'pbkdf2$abc$def')).toBe(false);
  });
});
