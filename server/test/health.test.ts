import { describe, expect, it } from 'vitest';

import app from '../src/index';

// Hono apps are runtime-agnostic, so app.request() exercises the real router
// in plain Node — no Miniflare needed for a binding-free route.
describe('GET /v1/health', () => {
  it('returns ok with a timestamp', async () => {
    const res = await app.request('/v1/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; time: number };
    expect(body.ok).toBe(true);
    expect(typeof body.time).toBe('number');
  });

  it('404s an unknown route', async () => {
    const res = await app.request('/v1/nope');
    expect(res.status).toBe(404);
  });
});

it('answers unknown routes with JSON, not HTML', async () => {
  const res = await app.request('/v1/nope');
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: 'NOT_FOUND' });
});
