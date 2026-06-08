import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components';
import { api, ApiError } from '@/lib/api';
import { appleSignInAvailable, signInWithApple } from '@/lib/auth';
import { useStore } from '@/store/useStore';
import { colors, fonts } from '@/theme';

const FRIENDLY: Record<string, string> = {
  INVITE_INVALID: "That invite link isn't valid.",
  INVITE_USED: 'That invite has already been used.',
  INVITE_EXPIRED: 'That invite link has expired.',
};

export default function InviteAccept() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [status, setStatus] = useState<'working' | 'error'>('working');
  const [message, setMessage] = useState('Joining…');

  const accept = async () => {
    setStatus('working');
    setMessage('Joining…');
    try {
      let session = useStore.getState().session;
      if (!session) {
        // Sign-in is required to join. This build is Apple-only; if Apple isn't
        // available we surface a dead end with an escape rather than a loop.
        if (!(await appleSignInAvailable())) {
          setStatus('error');
          setMessage('Sign in on the Moves screen, then reopen the link.');
          return;
        }
        await signInWithApple();
        session = useStore.getState().session;
      }
      if (!session || !token) throw new ApiError(400, 'INVITE_INVALID');
      const snap = await api.acceptInvite(session, token);
      const serverMoveId = (snap.move as { id: string }).id;
      useStore.getState().addSharedMoveFromSnapshot(serverMoveId, snap);
      router.replace('/(tabs)');
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof ApiError && FRIENDLY[e.code] ? FRIENDLY[e.code] : 'Could not join this move.');
    }
  };

  useEffect(() => {
    void accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <View style={styles.center}>
      {status === 'working' ? <ActivityIndicator color={colors.brand} /> : null}
      <Text style={styles.text}>{message}</Text>
      {status !== 'working' ? (
        <Button onPress={() => router.replace('/moves')}>Back to moves</Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: colors.surfaceApp },
  text: { fontFamily: fonts.body.bold, fontSize: 15, color: colors.textBody, textAlign: 'center' },
});
