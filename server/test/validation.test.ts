import { describe, expect, it } from 'vitest';

import { makeHarness } from './helpers/harness';

const auth = (session: string) => ({ headers: { Authorization: `Bearer ${session}` } });

describe('request body validation', () => {
  it('register: a malformed body is INVALID_EMAIL, a short password is WEAK_PASSWORD', async () => {
    const h = await makeHarness();
    const malformed = await h.request('/v1/auth/email/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    expect(malformed.status).toBe(400);
    expect(((await malformed.json()) as { error: string }).error).toBe('INVALID_EMAIL');

    const weak = await h.json('/v1/auth/email/register', { email: 'a@b.com', password: 'short' });
    expect(weak.status).toBe(400);
    expect(((await weak.json()) as { error: string }).error).toBe('WEAK_PASSWORD');
  });

  it('login: a malformed body gets the same generic 401 as a wrong password', async () => {
    const h = await makeHarness();
    const res = await h.json('/v1/auth/email/login', { email: 'not-an-email' });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_CREDENTIALS');
  });

  it('invites: an unknown role is rejected instead of being stored verbatim', async () => {
    const h = await makeHarness();
    const owner = await h.login('own', 'own@x.com');
    const created = await h.json('/v1/moves', { name: 'M' }, auth(owner.session));
    const { move } = (await created.json()) as { move: { id: string } };

    const bad = await h.json(`/v1/moves/${move.id}/invites`, { role: 'admin' }, auth(owner.session));
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toBe('INVALID_ROLE');

    const defaulted = await h.json(`/v1/moves/${move.id}/invites`, {}, auth(owner.session));
    expect(defaulted.status).toBe(200);
    expect(((await defaulted.json()) as { role: string }).role).toBe('viewer');
  });

  it('create move: a blank name is INVALID_NAME', async () => {
    const h = await makeHarness();
    const owner = await h.login('own', 'own@x.com');
    const res = await h.json('/v1/moves', { name: '   ' }, auth(owner.session));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('INVALID_NAME');
  });
});
