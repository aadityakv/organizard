import { describe, expect, it } from 'vitest';

import { makeHarness } from './helpers/harness';

describe('auth — email magic link', () => {
  it('sends a single-use link and signs in on verify', async () => {
    const h = await makeHarness();

    const start = await h.json('/v1/auth/email/start', { email: 'Sam@Example.com' });
    expect(start.status).toBe(200);
    expect(h.sentEmails).toHaveLength(1);
    expect(h.sentEmails[0].to).toBe('sam@example.com'); // normalized

    const token = new URL(h.sentEmails[0].link).searchParams.get('token');
    expect(token).toBeTruthy();

    const verify = await h.request(`/v1/auth/email/verify?token=${token}`);
    expect(verify.status).toBe(200);
    const body = (await verify.json()) as { session: string; user: { email: string; name: string } };
    expect(body.session).toBeTruthy();
    expect(body.user.email).toBe('sam@example.com');
    expect(body.user.name).toBe('Sam');

    // single-use: a second verify with the same token fails
    const again = await h.request(`/v1/auth/email/verify?token=${token}`);
    expect(again.status).toBe(400);
  });

  it('rejects an invalid email and sends nothing', async () => {
    const h = await makeHarness();
    const res = await h.json('/v1/auth/email/start', { email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(h.sentEmails).toHaveLength(0);
  });
});

describe('auth — Apple', () => {
  it('creates a user, and the same Apple sub maps to the same user', async () => {
    const h = await makeHarness();
    h.setAppleIdentity({ sub: 'apple_123', email: 'jo@example.com' });

    const r1 = await h.json('/v1/auth/apple', { identityToken: 'x' });
    expect(r1.status).toBe(200);
    const b1 = (await r1.json()) as { session: string; user: { id: string } };

    const r2 = await h.json('/v1/auth/apple', { identityToken: 'y' });
    const b2 = (await r2.json()) as { user: { id: string } };
    expect(b2.user.id).toBe(b1.user.id); // no duplicate account
  });

  it('401s an invalid Apple token', async () => {
    const h = await makeHarness(); // no identity set => verify throws
    const res = await h.json('/v1/auth/apple', { identityToken: 'bad' });
    expect(res.status).toBe(401);
  });
});

describe('auth — session (me / logout)', () => {
  it('me works with a session, 401s without, and logout revokes', async () => {
    const h = await makeHarness();
    h.setAppleIdentity({ sub: 'apple_1', email: 'a@b.com' });
    const login = await h.json('/v1/auth/apple', { identityToken: 'x' });
    const { session } = (await login.json()) as { session: string };

    const me = await h.request('/v1/me', { headers: { Authorization: `Bearer ${session}` } });
    expect(me.status).toBe(200);
    const meBody = (await me.json()) as { user: { email: string }; moves: unknown[] };
    expect(meBody.user.email).toBe('a@b.com');
    expect(meBody.moves).toEqual([]);

    const anon = await h.request('/v1/me');
    expect(anon.status).toBe(401);

    const out = await h.request('/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session}` },
    });
    expect(out.status).toBe(200);

    const after = await h.request('/v1/me', { headers: { Authorization: `Bearer ${session}` } });
    expect(after.status).toBe(401); // session revoked
  });
});
