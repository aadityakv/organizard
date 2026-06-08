// Worker runtime bindings (see wrangler.toml). D1Database / R2Bucket /
// KVNamespace come from @cloudflare/workers-types (global via tsconfig `types`).
export type Env = {
  DB: D1Database;
  PHOTOS: R2Bucket;
  SESSIONS: KVNamespace;
};
