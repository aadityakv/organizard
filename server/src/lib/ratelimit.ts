// Best-effort KV-backed rate limit (fixed-ish window). The read-modify-write isn't
// atomic, so highly-concurrent bursts can slip through; it reliably curbs sequential
// abuse. For a hard cap, back it with a Durable Object. Returns true if allowed.
export async function rateLimit(kv: KVNamespace, key: string, max: number, windowSec: number): Promise<boolean> {
  const k = `rl:${key}`;
  const raw = await kv.get(k);
  const count = raw ? parseInt(raw, 10) || 0 : 0;
  if (count >= max) return false;
  await kv.put(k, String(count + 1), { expirationTtl: windowSec });
  return true;
}
