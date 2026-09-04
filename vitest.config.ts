import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Pure-logic tests only (store/data/lib). We deliberately do NOT load the RN/expo
// runtime here — keep tested modules free of expo imports.
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, '.') } },
  test: {
    environment: 'node',
    include: ['store/**/*.test.ts', 'data/**/*.test.ts', 'lib/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/**', 'store/**', 'shared/**'],
      exclude: ['**/*.test.ts', 'lib/api/index.ts', 'lib/api/config.ts', 'store/useStore.ts'],
      thresholds: { lines: 65, branches: 70, functions: 50 },
    },
  },
});
