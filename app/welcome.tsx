// First-launch onboarding: log in / sign up, or continue as a guest (local-first).
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, SlothMark } from '@/components';
import { useStore } from '@/store/useStore';
import { colors, fonts, palette } from '@/theme';
import { routes } from '@/lib/routes';
import { copy } from '@/copy/onboarding';

/** First-launch onboarding: sign in, or continue as a guest. */
export default function Welcome() {
  const setOnboarded = useStore((s) => s.setOnboarded);

  const continueAsGuest = () => {
    setOnboarded(true);
    router.replace(routes.moves);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <View style={styles.markGlow}>
          <SlothMark size={104} />
        </View>
        <Text style={styles.wordmark}>{copy.appName}</Text>
        <Text style={styles.tagline}>{copy.tagline}</Text>
      </View>

      <View style={styles.actions}>
        <Button size="lg" fullWidth onPress={() => router.push(routes.signIn)}>
          {copy.signInButton}
        </Button>
        <Button variant="ghost" size="lg" fullWidth onPress={continueAsGuest}>
          {copy.guestButton}
        </Button>
        <Text style={styles.fine}>{copy.guestHint}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceApp },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 24 },
  markGlow: { alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontFamily: fonts.display.bold, fontSize: 40, color: palette.ink900, marginTop: 4 },
  tagline: { fontFamily: fonts.body.semibold, fontSize: 16, color: palette.ink500, textAlign: 'center' },
  actions: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  fine: {
    fontFamily: fonts.body.semibold,
    fontSize: 12.5,
    color: palette.ink400,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
