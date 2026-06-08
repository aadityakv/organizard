// Session token persistence — kept in the device keychain via expo-secure-store.
import * as SecureStore from 'expo-secure-store';

const KEY = 'organizard.session';

export async function loadSession(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function saveSession(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore
  }
}
