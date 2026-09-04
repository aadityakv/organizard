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
      // Modules that wrap a native/Expo dependency run only on a device or the
      // simulator; everything else under lib/ and store/ is measured.
      exclude: [
        '**/*.test.ts',
        '**/*.json',
        'lib/api/index.ts',
        'lib/api/config.ts',
        'lib/billing.ts',
        'lib/monitoring.ts',
        'lib/photos/index.ts',
        'lib/session.ts',
        'lib/voice/dictation.ts',
        'lib/voice/dictation.simulated.ts',
        'store/useStore.ts',
      ],
      thresholds: { lines: 70, branches: 60, functions: 55 },
    },
  },
});
