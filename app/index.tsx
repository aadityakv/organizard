import { Redirect } from 'expo-router';

import { useStore } from '@/store/useStore';

// Entry route — send first-run users to onboarding, returning users to the app.
export default function Index() {
  const onboarded = useStore((s) => s.onboarded);
  return <Redirect href={onboarded ? '/(tabs)' : '/onboarding'} />;
}
