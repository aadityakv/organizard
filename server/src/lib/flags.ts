// Feature flags read from Worker vars, plus the shared billing guard they feed.
import type { Context } from 'hono';

import type { Deps } from '../deps';
import { isOwnerEntitled } from '../repos/sharing';
import type { Env } from '../types';

/** Billing is off unless BILLING_ENABLED is the string 'true'; when off, entitlement gates are bypassed. */
export const billingEnabled = (env: Env): boolean => env.BILLING_ENABLED === 'true';

/**
 * The lapsed-subscription guard shared by every write path on a shared move
 * (mutations, invites, photo reservation, photo upload): a 402 Response when the
 * owner's entitlement is inactive, or null when the caller may proceed.
 */
export async function ownerEntitledOrResponse<S extends { Bindings: Env }>(
  deps: Deps,
  c: Context<S>,
  moveId: string,
): Promise<Response | null> {
  if (billingEnabled(c.env) && !(await isOwnerEntitled(deps.getDb(c.env), moveId, deps.now())))
    return c.json({ error: 'ENTITLEMENT_REQUIRED' }, 402);
  return null;
}
