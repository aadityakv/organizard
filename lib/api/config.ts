// Backend base URL. app.config.ts sets extra.apiUrl for every build profile; a build
// without it is misconfigured, so fail at startup rather than talk to the wrong host.
import Constants from 'expo-constants';

const configured = Constants.expoConfig?.extra?.apiUrl;
if (typeof configured !== 'string' || !configured) {
  throw new Error('extra.apiUrl is not set: build through app.config.ts (APP_ENV=production|staging|local)');
}

export const API_URL: string = configured;
