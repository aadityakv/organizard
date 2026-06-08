import Constants from 'expo-constants';

// Backend base URL — set per-environment in app.json `extra.apiUrl`.
export const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:8787';
