import { describe, expect, it } from 'vitest';

import { makeHarness } from './helpers/harness';

const auth = (s: string) => ({ headers: { Authorization: `Bearer ${s}` } });

describe('sessions — logout everywhere', () => {
  it("revokes all of a user's sessions", async () => {
    const h = await makeHarness();
    h.setAppleIdentity({ sub: 'u', email: 'u@x.com' });
    const a = (await (await h.json('/v1/auth/apple', { identityToken: 'x' })).json()) as { session: string };
    const b = (await (await h.json('/v1/auth/apple', { identityToken: 'x' })).json()) as { session: string };

    expect((await h.request('/v1/me', auth(a.session))).status).toBe(200);
    expect((await h.request('/v1/me', auth(b.session))).status).toBe(200);

    expect((await h.request('/v1/auth/logout-all', { method: 'POST', ...auth(a.session) })).status).toBe(200);

    expect((await h.request('/v1/me', auth(a.session))).status).toBe(401);
    expect((await h.request('/v1/me', auth(b.session))).status).toBe(401);
  });
});

describe('auth — rate limiting', () => {
  it('429s after too many email/start requests for one address', async () => {
    const h = await makeHarness();
    for (let i = 0; i < 5; i++) {
      expect((await h.json('/v1/auth/email/start', { email: 'spam@x.com' })).status).toBe(200);
    }
    expect((await h.json('/v1/auth/email/start', { email: 'spam@x.com' })).status).toBe(429);
  });
});
