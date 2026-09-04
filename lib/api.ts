// The app's API instance, pointed at the configured backend.
import { createApi } from './apiClient';
import { API_URL } from './config';

export const api = createApi(API_URL);
export * from './apiClient';
