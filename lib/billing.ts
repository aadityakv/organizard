// RevenueCat (Apple IAP) wrapper. The "sharing" entitlement gates owning a shared
// move. The server is the source of truth (its webhook sets entitlement); this is
// the in-app paywall. No-ops gracefully when no RevenueCat key is configured.
import Constants from 'expo-constants';
import Purchases from 'react-native-purchases';

const API_KEY = (Constants.expoConfig?.extra?.revenueCatKey as string | undefined) ?? '';
const ENTITLEMENT = 'sharing';
let configured = false;

export const billingConfigured = (): boolean => API_KEY.length > 0;

/** Configure RevenueCat with our user id (so the webhook's app_user_id matches). */
export function configureBilling(userId: string): void {
  if (!billingConfigured()) return;
  if (!configured) {
    Purchases.configure({ apiKey: API_KEY, appUserID: userId });
    configured = true;
  } else {
    void Purchases.logIn(userId).catch(() => {});
  }
}

export async function isEntitled(): Promise<boolean> {
  if (!billingConfigured()) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return Boolean(info.entitlements.active[ENTITLEMENT]);
  } catch {
    return false;
  }
}

/** Present the subscription and return whether the entitlement is now active. */
export async function purchaseSharing(): Promise<boolean> {
  if (!billingConfigured()) throw new Error('Billing is not configured in this build');
  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.availablePackages?.[0];
  if (!pkg) throw new Error('No subscription is available right now');
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return Boolean(customerInfo.entitlements.active[ENTITLEMENT]);
}
