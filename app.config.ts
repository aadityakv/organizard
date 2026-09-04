// Expo config: app.json holds the static manifest; this layer picks the backend per
// build profile (APP_ENV from eas.json) and passes runtime keys from the environment.
import type { ExpoConfig } from 'expo/config';

import appJson from './app.json';

const API_URLS: Record<string, string> = {
  production: 'https://organizard-api.aaditya-kv.workers.dev',
  staging: 'https://organizard-api-staging.aaditya-kv.workers.dev',
  local: 'http://localhost:8787',
};

const appEnv = process.env.APP_ENV ?? 'production';
const base = appJson.expo as ExpoConfig;

const sentryPlugin =
  process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? [
        [
          '@sentry/react-native/expo',
          { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT },
        ],
      ]
    : [];

const config: ExpoConfig = {
  ...base,
  plugins: [...(base.plugins ?? []), ...sentryPlugin] as ExpoConfig['plugins'],
  extra: {
    ...base.extra,
    appEnv,
    apiUrl: API_URLS[appEnv] ?? API_URLS.production,
    sentryDsn: process.env.SENTRY_DSN ?? '',
  },
};

export default config;
