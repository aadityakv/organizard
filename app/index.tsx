// Entry route. Fresh installs see onboarding; otherwise open the current move (or the
// Moves library). Existing users (a session or any saved move) skip onboarding.
import { Redirect } from 'expo-router';

import { useStore } from '@/store/useStore';
import { routes } from '@/lib/routes';

/** Entry redirect: onboarding, the open move, or the library. */
export default function Index() {
  const currentMoveId = useStore((s) => s.currentMoveId);
  const onboarded = useStore((s) => s.onboarded);
  const session = useStore((s) => s.session);
  const hasMoves = useStore((s) => Object.keys(s.library).length > 0);

  if (!onboarded && !session && !hasMoves) return <Redirect href={routes.welcome} />;
  return <Redirect href={currentMoveId ? routes.tabs : routes.moves} />;
}
