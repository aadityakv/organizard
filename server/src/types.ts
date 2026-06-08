// Worker runtime bindings (see wrangler.toml). D1Database / R2Bucket /
// KVNamespace come from @cloudflare/workers-types (global via tsconfig `types`).
export type Env = {
  DB: D1Database;
  PHOTOS: R2Bucket;
  SESSIONS: KVNamespace;
  // Secrets / vars (set via `wrangler secret put` / [vars]); optional so local
  // dev and tests work without them configured.
  RESEND_API_KEY?: string;
  APPLE_BUNDLE_ID?: string;
  /** Base URL used to build the magic-link (deep link), e.g. organizard://. */
  APP_URL?: string;
};
