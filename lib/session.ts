// Session token persistence — kept in the device keychain via expo-secure-store.
import * as SecureStore from 'expo-secure-store';

const KEY = 'organizard.session';

/** Read the session token from the keychain (null if none or unavailable). */
export async function loadSession(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

/** Store the session token in the keychain. */
export async function saveSession(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, token);
}

/** Remove the session token from the keychain. */
export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore
  }
}
