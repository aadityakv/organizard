// Navigation helpers that need the live router (so they stay out of lib/routes, which
// is pure). A screen opened straight from a deep link — a printed label scanned with
// the system camera, an invite link — is the only entry in the stack, so a plain
// router.back() there does nothing. Fall back to the entry route instead.
import { router } from 'expo-router';

import { routes } from '@/lib/routes';

/** Go back if there is somewhere to go back to; otherwise land on the entry route. */
export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace(routes.home);
}
