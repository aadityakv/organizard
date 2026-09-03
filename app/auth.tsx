import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { completeEmailSignIn } from '@/lib/auth';
import { colors, fonts } from '@/theme';

// Handles the magic-link deep link: organizard://auth?token=…
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
      router.replace('/members');
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
