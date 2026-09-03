import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import * as schema from '../src/db/schema';
import { makeHarness } from './helpers/harness';

describe('auth — email/password', () => {
  it('registers, returns a session, and me works', async () => {
    const h = await makeHarness();
    const res = await h.json('/v1/auth/email/register', {
      email: 'New@Example.com',
      password: 'hunter2hunter',
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { session: string; user: { email: string; id: string } };
    expect(body.session).toBeTruthy();
    expect(body.user.email).toBe('new@example.com'); // normalized

    const me = await h.request('/v1/me', { headers: { Authorization: `Bearer ${body.session}` } });
    expect(me.status).toBe(200);
  });

  it('never leaks the password hash to the client', async () => {
    const h = await makeHarness();
    const res = await h.json('/v1/auth/email/register', { email: 'a@b.com', password: 'password123' });
    const body = (await res.json()) as { user: Record<string, unknown> };
    expect(body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('pbkdf2');
  });

  it('rejects a duplicate email with 409 EMAIL_TAKEN', async () => {
    const h = await makeHarness();
    await h.json('/v1/auth/email/register', { email: 'dup@example.com', password: 'password123' });
    const again = await h.json('/v1/auth/email/register', {
      email: 'DUP@example.com',
      password: 'password123',
    });
    expect(again.status).toBe(409);
    expect(((await again.json()) as { error: string }).error).toBe('EMAIL_TAKEN');
  });

  it('rejects a weak password and an invalid email', async () => {
    const h = await makeHarness();
    expect((await h.json('/v1/auth/email/register', { email: 'x@y.com', password: 'short' })).status).toBe(
      400,
    );
    expect(
      (await h.json('/v1/auth/email/register', { email: 'not-email', password: 'password123' })).status,
    ).toBe(400);
  });

  it('logs in with the correct password and 401s otherwise', async () => {
    const h = await makeHarness();
    await h.json('/v1/auth/email/register', { email: 'log@example.com', password: 'correctpass1' });

    const ok = await h.json('/v1/auth/email/login', { email: 'LOG@example.com', password: 'correctpass1' });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { session: string }).session).toBeTruthy();

    expect(
      (await h.json('/v1/auth/email/login', { email: 'log@example.com', password: 'wrongpass1' })).status,
    ).toBe(401);
    expect(
      (await h.json('/v1/auth/email/login', { email: 'nobody@example.com', password: 'whatever1' })).status,
    ).toBe(401);
  });

  it('does not let a Sign-in-with-Apple user log in by password', async () => {
    const h = await makeHarness();
    h.setAppleIdentity({ sub: 'apple_x', email: 'apple@example.com' });
    await h.json('/v1/auth/apple', { identityToken: 'x' });
    const res = await h.json('/v1/auth/email/login', { email: 'apple@example.com', password: 'anything123' });
    expect(res.status).toBe(401); // no passwordHash on that account
  });
});

describe('auth — delete account', () => {
  it('removes the user, their owned move + data, memberships, and sessions', async () => {
    const h = await makeHarness({ billing: false });
    const reg = await h.json('/v1/auth/email/register', {
      email: 'del@example.com',
      password: 'password123',
    });
    const { session, user } = (await reg.json()) as { session: string; user: { id: string } };

    const mv = await h.json(
      '/v1/moves',
      { name: 'My Move' },
      { headers: { Authorization: `Bearer ${session}` } },
    );
    expect(mv.status).toBe(201);
    const owned = await h.db.select().from(schema.moves).where(eq(schema.moves.ownerId, user.id));
    expect(owned).toHaveLength(1);

    const del = await h.request('/v1/auth/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session}` },
    });
    expect(del.status).toBe(200);

    expect(await h.db.select().from(schema.users).where(eq(schema.users.id, user.id))).toHaveLength(0);
    expect(await h.db.select().from(schema.moves).where(eq(schema.moves.ownerId, user.id))).toHaveLength(0);
    expect(await h.db.select().from(schema.members).where(eq(schema.members.userId, user.id))).toHaveLength(
      0,
    );

    const me = await h.request('/v1/me', { headers: { Authorization: `Bearer ${session}` } });
    expect(me.status).toBe(401); // session revoked
  });

  it('401s deleting an account without a session', async () => {
    const h = await makeHarness();
    const res = await h.request('/v1/auth/account', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});
