// Injectable dependencies — the seam that makes the Worker testable without
// real Apple / network / time. Tests override only what they need.
import { getDb, type AppDb } from './db/client';
import { verifyAppleToken, type AppleIdentity } from './lib/apple';
import { newId, newToken } from './lib/ids';
import type { Env } from './types';

export type Deps = {
  getDb: (env: Env) => AppDb;
  now: () => number;
  newId: () => string;
  newToken: () => string;
  verifyApple: (identityToken: string, bundleId: string | undefined) => Promise<AppleIdentity>;
  /** Structured log sink (one JSON line per call). Tests replace it with a no-op. */
  log: (level: 'info' | 'error', line: string) => void;
};

export const defaultDeps: Deps = {
  getDb,
  now: () => Date.now(),
  newId,
  newToken,
  verifyApple: verifyAppleToken,
  log: (level, line) => (level === 'error' ? console.error(line) : console.log(line)),
};
