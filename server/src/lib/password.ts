// Password hashing for email/password sign-in. PBKDF2 via WebCrypto — no native
// deps, runs the same in the Workers runtime and in Node 20+ (tests). Stored as a
// self-describing string: `pbkdf2$<iterations>$<saltB64>$<hashB64>`.
import { timingSafeEqualBytes } from './bytes';

const ITERATIONS = 100_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const enc = new TextEncoder();

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

/** Hash a password with a fresh salt; the result is self-describing for verification. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

/** Verify a password against a stored hash. False on any malformed/empty input. */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromB64(parts[2]);
    expected = fromB64(parts[3]);
  } catch {
    return false;
  }
  const actual = await derive(password, salt, iterations);
  return timingSafeEqualBytes(actual, expected);
}

/**
 * A hash of an unguessable throwaway password. Login verifies against this when
 * the email has no account, so an unknown email costs the same ~100k-iteration
 * derive as a wrong password and response timing can't reveal account existence.
 */
export const DUMMY_PASSWORD_HASH =
  'pbkdf2$100000$ASNFZ4mrze8BI0VniavN7w==$/LmaGyf9rqRo0+FUFYGZqCp4X4RM8oMHl/rqDJUr9lY=';
