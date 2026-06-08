import { createRemoteJWKSet, jwtVerify } from 'jose';

export type AppleIdentity = { sub: string; email?: string | null };

// Apple's public keys for "Sign in with Apple" identity tokens.
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

/**
 * Verify an Apple identity token's signature, issuer, and (if provided) audience.
 * Returns the stable `sub` (Apple user id) + optional email.
 * Throws if the token is invalid/expired.
 */
export async function verifyAppleToken(
  identityToken: string,
  bundleId: string | undefined,
): Promise<AppleIdentity> {
  const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
    issuer: 'https://appleid.apple.com',
    audience: bundleId, // undefined => audience check skipped
  });
  if (!payload.sub) throw new Error('Apple token missing sub');
  return { sub: payload.sub, email: (payload.email as string | undefined) ?? null };
}
