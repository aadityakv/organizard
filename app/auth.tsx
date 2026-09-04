// Handles the magic-link deep link: organizard://auth?token=…
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { completeEmailSignIn } from '@/services/auth';
import { colors, fonts } from '@/theme';
import { routes } from '@/lib/routes';

/** Completes a magic-link sign-in from its deep link, then routes into the app. */
export default function AuthVerify() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (token) await completeEmailSignIn(token);
      } catch {
        setFailed(true);
      }
      router.replace(routes.members);
    })();
  }, [token]);

  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.brand} />
      <Text style={styles.text}>{failed ? 'That link didn’t work — try again.' : 'Signing you in…'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.surfaceApp,
  },
  text: { fontFamily: fonts.body.bold, color: colors.textBody },
});
