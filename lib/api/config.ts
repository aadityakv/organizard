// Backend base URL — set per-environment in app.json `extra.apiUrl`.
import Constants from 'expo-constants';

export const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:8787';
