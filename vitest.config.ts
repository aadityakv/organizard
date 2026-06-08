import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Pure-logic tests only (store/data). We deliberately do NOT load the RN/expo
// runtime here — keep tested modules free of expo imports.
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, '.') } },
  test: {
    environment: 'node',
    include: ['store/**/*.test.ts', 'data/**/*.test.ts'],
  },
});
