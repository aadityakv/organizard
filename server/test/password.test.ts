import { describe, expect, it } from 'vitest';

import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from '../src/lib/password';

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

  it('the dummy hash is well-formed (login timing equalizer actually derives)', async () => {
    // If this shape breaks (e.g. a missing iterations segment), verifyPassword
    // short-circuits without any PBKDF2 work and unknown-email logins answer
    // instantly again — the account-enumeration oracle returns.
    const parts = DUMMY_PASSWORD_HASH.split('$');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('pbkdf2');
    expect(parts[1]).toBe('100000'); // matches the production iteration count
    expect(parts[2].length).toBeGreaterThan(0);
    expect(parts[3].length).toBeGreaterThan(0);
    // It must verify (i.e. run the full derive) and always fail.
    expect(await verifyPassword('anything', DUMMY_PASSWORD_HASH)).toBe(false);
  });
});
