import { describe, expect, it } from 'vitest';

import { makeHarness } from './helpers/harness';

const auth = (session: string) => ({ headers: { Authorization: `Bearer ${session}` } });

describe('billing — owner pays to share', () => {
  it('blocks move creation without an entitlement, then allows it after a purchase webhook', async () => {
    const h = await makeHarness();
    const user = await h.login('u', 'u@x.com', { entitled: false });

    // no entitlement -> 402
    expect((await h.json('/v1/moves', { name: 'NYC' }, auth(user.session))).status).toBe(402);

    // RevenueCat purchase webhook grants it
    expect((await h.webhook('INITIAL_PURCHASE', user.user.id)).status).toBe(200);
    expect((await h.json('/v1/moves', { name: 'NYC' }, auth(user.session))).status).toBe(201);
  });

  it('revokes on an expiration webhook', async () => {
    const h = await makeHarness();
    const user = await h.login('u', 'u@x.com'); // entitled by default
    expect((await h.json('/v1/moves', { name: 'A' }, auth(user.session))).status).toBe(201);

    expect((await h.webhook('EXPIRATION', user.user.id)).status).toBe(200);
    expect((await h.json('/v1/moves', { name: 'B' }, auth(user.session))).status).toBe(402);
  });

  it('rejects a webhook with a bad/missing secret', async () => {
    const h = await makeHarness();
    // no auth header -> 401 (fail closed)
    const res = await h.json('/v1/webhooks/revenuecat', { event: { type: 'INITIAL_PURCHASE', app_user_id: 'x' } });
    expect(res.status).toBe(401);
  });

  it('honors entitlement expiry (active flag alone is not enough)', async () => {
    const h = await makeHarness();
    const user = await h.login('u', 'u@x.com', { entitled: false });
    // grant, but with an expiry already in the past
    await h.json(
      '/v1/webhooks/revenuecat',
      { event: { type: 'INITIAL_PURCHASE', app_user_id: user.user.id, expiration_at_ms: 1 } },
      { headers: { authorization: 'Bearer test-secret' } },
    );
    expect((await h.json('/v1/moves', { name: 'X' }, auth(user.session))).status).toBe(402); // expired -> blocked
  });
});
