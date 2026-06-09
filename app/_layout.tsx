import { useEffect, useState } from 'react';
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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
  const [sessionRestored, setSessionRestored] = useState(false);
  const ready = fontsLoaded && hydrated && sessionRestored;

  // Sync engine (no-op for local moves) + restore the session token from the keychain.
  // The session MUST be in the store before the first screen renders: shared-move
  // photos are server URLs that need this token in their Authorization header. If a
  // photo <Image> renders before the token is restored it gets a 401, and iOS caches
  // that failure so it never recovers once the token loads — the photo appears to
  // "vanish" on reopen. Gating `ready` on the restore closes that window. (loadSession
  // resolves fast — null for local-only users — so this adds no perceptible delay.)
  useSync();
  useEffect(() => {
    loadSession()
      .then((t) => {
        if (t) useStore.setState({ session: t });
      })
      .finally(() => setSessionRestored(true));
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.surfaceApp).catch(() => {});
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
          <Stack.Screen name="moves" />
          <Stack.Screen name="new-move" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="box/[id]" />
          <Stack.Screen name="item/[id]" />
          <Stack.Screen name="add-item" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="print-labels" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="qr/[id]" options={{ presentation: 'modal', animation: 'fade' }} />
          {/* Card modal (NOT fullScreenModal): a fullScreenModal is dead to touch on
              iOS 26 — its close X never fired, trapping the user (force-quit). A card
              modal reliably receives taps AND has a native swipe-down-to-dismiss, so the
              user can always get out (swipe down · tap the photo · the X). */}
          <Stack.Screen name="gallery/[boxId]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="auth" options={{ presentation: 'modal', animation: 'fade' }} />
          <Stack.Screen name="invite" options={{ presentation: 'modal', animation: 'fade' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
