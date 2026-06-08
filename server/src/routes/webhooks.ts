import { Hono } from 'hono';

import type { Deps } from '../deps';
import { setEntitlement } from '../repos/users';
import type { Env } from '../types';

// RevenueCat sets app_user_id to our user id (client calls Purchases.logIn(userId)).
const GRANT = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE']);
const REVOKE = new Set(['EXPIRATION', 'BILLING_ISSUE', 'SUBSCRIPTION_PAUSED']);

export function webhookRoutes(deps: Deps) {
  const r = new Hono<{ Bindings: Env }>();

  r.post('/revenuecat', async (c) => {
    const secret = c.env.REVENUECAT_WEBHOOK_SECRET;
    if (secret && c.req.header('authorization') !== `Bearer ${secret}`) return c.json({ error: 'UNAUTHORIZED' }, 401);

    const body = await c.req
      .json<{ event?: { type?: string; app_user_id?: string; expiration_at_ms?: number } }>()
      .catch(() => ({}) as { event?: undefined });
    const ev = body.event;
    if (!ev?.type || !ev.app_user_id) return c.json({ error: 'BAD_EVENT' }, 400);

    const db = deps.getDb(c.env);
    if (GRANT.has(ev.type)) await setEntitlement(db, ev.app_user_id, true, ev.expiration_at_ms ?? null);
    else if (REVOKE.has(ev.type)) await setEntitlement(db, ev.app_user_id, false, null);

    return c.json({ ok: true });
  });

  return r;
}
