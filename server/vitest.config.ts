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
      // The real-world adapters behind Deps (D1 driver, Apple JWKS, crypto ids) are
      // replaced by fakes in the harness, so they are not measured.
      exclude: ['src/defaults.ts', 'src/index.ts', 'src/db/client.ts', 'src/lib/apple.ts', 'src/lib/ids.ts'],
      thresholds: { lines: 85, branches: 75, functions: 85 },
    },
  },
});
