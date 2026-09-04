// Sign in with Apple: identity-token verification against Apple's JWKS.
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
  // Fail closed: without our bundle id the audience check would be skipped,
  // accepting tokens minted for any other app.
  if (!bundleId) throw new Error('APPLE_BUNDLE_ID not configured');
  const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
    issuer: 'https://appleid.apple.com',
    audience: bundleId,
  });
  if (!payload.sub) throw new Error('Apple token missing sub');
  // Only trust the email for account-linking if Apple says it's verified.
  const verified = payload.email_verified === true || payload.email_verified === 'true';
  return { sub: payload.sub, email: verified ? ((payload.email as string | undefined) ?? null) : null };
}
