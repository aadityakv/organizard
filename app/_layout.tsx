import { useEffect } from 'react';
import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { loadSession } from '@/lib/session';
import { useSync } from '@/store/sync';
import { useHasHydrated, useStore } from '@/store/useStore';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const hydrated = useHasHydrated();
  const ready = fontsLoaded && hydrated;

  // Sync engine (no-op for local moves) + restore the session token from the keychain.
  useSync();
  useEffect(() => {
    loadSession().then((t) => {
      if (t) useStore.setState({ session: t });
    });
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.surfaceApp).catch(() => {});
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surfaceApp },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="moves" />
        <Stack.Screen name="new-move" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="box/[id]" />
        <Stack.Screen name="share" />
        <Stack.Screen name="add-item" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="qr/[id]" options={{ presentation: 'modal', animation: 'fade' }} />
        <Stack.Screen name="auth" options={{ presentation: 'modal', animation: 'fade' }} />
        <Stack.Screen name="invite" options={{ presentation: 'modal', animation: 'fade' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
