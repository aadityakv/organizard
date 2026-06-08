// Injectable dependencies — the seam that makes the Worker testable without
// real Apple / Resend / network / time. Tests override only what they need.
import { getDb, type AppDb } from './db/client';
import { verifyAppleToken, type AppleIdentity } from './lib/apple';
import { sendMagicLinkEmail } from './lib/email';
import { newId, newToken } from './lib/ids';
import type { Env } from './types';

export type Deps = {
  getDb: (env: Env) => AppDb;
  now: () => number;
  newId: () => string;
  newToken: () => string;
  verifyApple: (identityToken: string, bundleId: string | undefined) => Promise<AppleIdentity>;
  sendEmail: (env: Env, to: string, link: string) => Promise<void>;
};

export const defaultDeps: Deps = {
  getDb,
  now: () => Date.now(),
  newId,
  newToken,
  verifyApple: verifyAppleToken,
  sendEmail: sendMagicLinkEmail,
};
