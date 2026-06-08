// Simple KV-backed rate limit (fixed-ish window). Returns true if the call is allowed.
export async function rateLimit(kv: KVNamespace, key: string, max: number, windowSec: number): Promise<boolean> {
  const k = `rl:${key}`;
  const raw = await kv.get(k);
  const count = raw ? parseInt(raw, 10) || 0 : 0;
  if (count >= max) return false;
  await kv.put(k, String(count + 1), { expirationTtl: windowSec });
  return true;
}
