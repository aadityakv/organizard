// Sign-in helpers. On success: persist the session in the keychain and set it in
// the store. Apple uses expo-apple-authentication; email uses an email + password.
import * as AppleAuthentication from 'expo-apple-authentication';

import { api } from '@/lib/api';
import { saveSession } from '@/lib/session';
import { syncLocalMovesUp } from '@/lib/share';
import { pullServerMoves } from '@/store/sync';
import { useStore } from '@/store/useStore';

async function adoptSession(session: string, user: { id: string; name: string; email: string | null }): Promise<void> {
  await saveSession(session);
  useStore.getState().setSession(session, { id: user.id, name: user.name, email: user.email });
  useStore.getState().setOnboarded(true); // signing in completes onboarding
  // Pull this account's existing moves onto the device, then push up any local (guest)
  // moves so everything is synced/backed up ("synced by default"). Failures are non-fatal.
  await pullServerMoves();
  await syncLocalMovesUp();
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

/** Email + password — create a new account. */
export async function registerWithEmail(email: string, password: string): Promise<void> {
  const { session, user } = await api.emailRegister(email, password);
  await adoptSession(session, user);
}

/** Email + password — sign in to an existing account. */
export async function loginWithEmail(email: string, password: string): Promise<void> {
  const { session, user } = await api.emailLogin(email, password);
  await adoptSession(session, user);
}

/**
 * Permanently delete the signed-in account and all server data, then clear the
 * local session. The active local move data (if any) stays on the device.
 */
export async function deleteAccount(): Promise<void> {
  const { session, signOut } = useStore.getState();
  if (session) await api.deleteAccount(session);
  signOut();
}

/** Legacy magic-link verify — still handled if an old link is opened. */
export async function completeEmailSignIn(token: string): Promise<void> {
  const { session, user } = await api.emailVerify(token);
  await adoptSession(session, user);
}
