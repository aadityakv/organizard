import { describe, expect, it, vi } from 'vitest';

import { ApiError, createApi } from '@/lib/api/client';

type Call = { url: string; init: RequestInit };

/** A fetch double that records calls and replies with the given response. */
function fakeFetch(reply: () => Promise<Response>) {
  const calls: Call[] = [];
  const impl = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return reply();
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('createApi', () => {
  it('prefixes the base URL and sends the bearer session', async () => {
    const f = fakeFetch(async () => json({ user: { id: 'u1' }, moves: [] }));
    const api = createApi('https://api.test', f.impl);
    await api.me('tok');
    expect(f.calls[0].url).toBe('https://api.test/v1/me');
    expect((f.calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it("turns a non-2xx into an ApiError carrying the server's code", async () => {
    const f = fakeFetch(async () => json({ error: 'EMAIL_TAKEN' }, 409));
    const api = createApi('https://api.test', f.impl);
    await expect(api.emailRegister('a@b.c', 'password1')).rejects.toMatchObject({
      status: 409,
      code: 'EMAIL_TAKEN',
    });
  });

  it('falls back to a generic code when the error body is not JSON', async () => {
    const f = fakeFetch(async () => new Response('gateway down', { status: 502 }));
    const api = createApi('https://api.test', f.impl);
    const err = await api.me('tok').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('ERROR');
  });

  it('aborts a request that exceeds the timeout', async () => {
    vi.useFakeTimers();
    try {
      const f = fakeFetch(
        () =>
          new Promise<Response>((_, reject) => {
            // A fetch that only settles when its signal aborts, like a stalled connection.
            f.calls[0].init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );
      const api = createApi('https://api.test', f.impl, 1_000);
      const pending = api.me('tok');
      const outcome = pending.catch((e: Error) => e.message);
      await vi.advanceTimersByTimeAsync(1_001);
      expect(await outcome).toBe('aborted');
      expect(f.calls[0].init.signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
