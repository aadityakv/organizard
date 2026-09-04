// Worker runtime bindings (see wrangler.toml). D1Database / R2Bucket /
// KVNamespace come from @cloudflare/workers-types (global via tsconfig `types`).
export type Env = {
  DB: D1Database;
  PHOTOS: R2Bucket;
  SESSIONS: KVNamespace;
  // Secrets / vars (set via `wrangler secret put` / [vars]); optional so local
  // dev and tests work without them configured.
  APPLE_BUNDLE_ID?: string;
  /** Shared secret for verifying the RevenueCat webhook. */
  REVENUECAT_WEBHOOK_SECRET?: string;
  /**
   * Gate the "owner pays to share" entitlement checks. Defaults OFF — when unset
   * or anything other than the string "true", sharing/sync/photos are FREE (no
   * subscription required). Set to "true" to enforce paid entitlement.
   */
  BILLING_ENABLED?: string;
};
