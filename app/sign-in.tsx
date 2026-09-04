// Standalone auth screen reached from onboarding ("Log in or sign up").
import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthPanel, Header } from '@/components';
import { colors } from '@/theme';
import { routes } from '@/lib/routes';
import { copy } from '@/copy/onboarding';

/** Sign-in screen reached from onboarding. */
export default function SignIn() {
  const done = () => {
    // Land in the library; any shared moves pulled on sign-in appear there.
    router.replace(routes.moves);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title={copy.welcomeToTuck} subtitle={copy.logInOrCreateAn} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AuthPanel title={copy.logInOrSignUp} subtitle={copy.signInToShareMoves} onAuthed={done} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceApp },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 60 },
});
