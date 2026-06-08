import { drizzle } from 'drizzle-orm/sql-js';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import initSqlJs from 'sql.js';

import type { AppDb } from '../../src/db/client';
import * as schema from '../../src/db/schema';

const require = createRequire(import.meta.url);
const drizzleDir = join(import.meta.dirname, '../../drizzle');

/**
 * Fresh in-memory SQLite (sql.js / pure WASM — no native build) with the real
 * generated migrations applied, returned as an AppDb. D1 is SQLite, so the query
 * builder is identical; we cast across the driver boundary (repos always await,
 * which is safe for the sync sql.js driver too).
 */
export async function makeTestDb(): Promise<AppDb> {
  const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') });
  const sqlite = new SQL.Database();
  const files = readdirSync(drizzleDir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    sqlite.run(readFileSync(join(drizzleDir, f), 'utf8')); // runs all statements; -- comments ignored
  }
  return drizzle(sqlite, { schema }) as unknown as AppDb;
}
