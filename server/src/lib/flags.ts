// Feature flags read from Worker vars.
import type { Env } from '../types';

/**
 * Billing defaults OFF. Sharing a move (online sync, invites, photos) is free
 * until the owner explicitly enables paid entitlement by setting the
 * BILLING_ENABLED var to the literal string "true". When billing is off, the
 * "owner pays to share" entitlement gates are bypassed entirely.
 */
export const billingEnabled = (env: Env): boolean => env.BILLING_ENABLED === 'true';
