import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Mirror the tsconfig `@shared/*` path so vitest (vite) resolves it too.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/seed.ts', 'src/index.ts'],
      thresholds: { lines: 85, branches: 75, functions: 85 },
    },
  },
});
