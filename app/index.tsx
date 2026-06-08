import { Redirect } from 'expo-router';

import { useStore } from '@/store/useStore';

// Entry route — open your current move if you have one, else the Moves library.
export default function Index() {
  const currentMoveId = useStore((s) => s.currentMoveId);
  return <Redirect href={currentMoveId ? '/(tabs)' : '/moves'} />;
}
