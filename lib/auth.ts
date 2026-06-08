// Sign-in helpers. On success: persist the session in the keychain and set it in
// the store. Apple uses expo-apple-authentication; email uses the magic-link flow.
import * as AppleAuthentication from 'expo-apple-authentication';

import { api } from '@/lib/api';
import { saveSession } from '@/lib/session';
import { useStore } from '@/store/useStore';

async function adoptSession(session: string, user: { id: string; name: string; email: string | null }): Promise<void> {
  await saveSession(session);
  useStore.getState().setSession(session, { id: user.id, name: user.name, email: user.email });
}

export const appleSignInAvailable = (): Promise<boolean> => AppleAuthentication.isAvailableAsync();

export async function signInWithApple(): Promise<void> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) throw new Error('No Apple identity token');
  const { session, user } = await api.appleLogin(credential.identityToken);
  await adoptSession(session, user);
}

/** Step 1 of email sign-in — sends the magic link. */
export async function startEmailSignIn(email: string): Promise<void> {
  await api.emailStart(email);
}

/** Step 2 — called from the deep link (organizard://auth?token=…). */
export async function completeEmailSignIn(token: string): Promise<void> {
  const { session, user } = await api.emailVerify(token);
  await adoptSession(session, user);
}
