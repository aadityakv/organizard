// Feature flags read from Worker vars.
import type { Env } from '../types';

/** Billing is off unless BILLING_ENABLED is the string 'true'; when off, entitlement gates are bypassed. */
export const billingEnabled = (env: Env): boolean => env.BILLING_ENABLED === 'true';
