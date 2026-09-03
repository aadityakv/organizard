import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, SlothMark } from '@/components';
import { useStore } from '@/store/useStore';
import { colors, fonts, palette } from '@/theme';

// First-launch onboarding: log in / sign up, or continue as a guest (local-first).
export default function Welcome() {
  const setOnboarded = useStore((s) => s.setOnboarded);

  const continueAsGuest = () => {
    setOnboarded(true);
    router.replace('/moves');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <View style={styles.markGlow}>
          <SlothMark size={104} />
        </View>
        <Text style={styles.wordmark}>Tuck</Text>
        <Text style={styles.tagline}>Pack fast. Find anything. Share the load.</Text>
      </View>

      <View style={styles.actions}>
        <Button size="lg" fullWidth onPress={() => router.push('/sign-in')}>
          Log in or sign up
        </Button>
        <Button variant="ghost" size="lg" fullWidth onPress={continueAsGuest}>
          Continue as guest
        </Button>
        <Text style={styles.fine}>
          Guest moves stay on this device. Make an account anytime to share a move.
        </Text>
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
