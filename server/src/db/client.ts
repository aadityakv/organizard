import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';

import type { Env } from '../types';
import * as schema from './schema';

export type AppDb = DrizzleD1Database<typeof schema>;

/** Drizzle client bound to the request's D1. Overridable in tests via deps. */
export const getDb = (env: Env): AppDb => drizzle(env.DB, { schema });
