import { defineConfig } from 'drizzle-kit';

// Generates plain SQLite migrations from the schema into ./drizzle.
// D1 is SQLite, so `wrangler d1 migrations apply` consumes these directly.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
