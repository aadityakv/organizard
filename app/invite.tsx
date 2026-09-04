// Invite deep link (tuck://invite?token=…). Signs the user in with Apple if there is
// no session, redeems the token, adds the shared move to the library and opens it.
// Errors show a friendly message with a way back to the library.
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components';
import { api, ApiError } from '@/lib/api';
import { appleSignInAvailable, signInWithApple } from '@/services/auth';
import { useStore } from '@/store/useStore';
import { colors, fonts } from '@/theme';
import { routes } from '@/lib/routes';

const FRIENDLY: Record<string, string> = {
  INVITE_INVALID: "That invite link isn't valid.",
  INVITE_USED: 'That invite has already been used.',
  INVITE_EXPIRED: 'That invite link has expired.',
};

type Outcome = { status: 'working' } | { status: 'joined' } | { status: 'error'; message: string };

async function joinMove(token: string | undefined): Promise<Outcome> {
  try {
    let session = useStore.getState().session;
    if (!session) {
      // Sign-in is required to join. If Apple sign-in isn't available we surface a
      // dead end with an escape rather than a loop.
      if (!(await appleSignInAvailable())) {
        return { status: 'error', message: 'Sign in on the Moves screen, then reopen the link.' };
      }
      await signInWithApple();
      session = useStore.getState().session;
    }
    if (!session || !token) throw new ApiError(400, 'INVITE_INVALID');
    const snap = await api.acceptInvite(session, token);
    const serverMoveId = (snap.move as { id: string }).id;
    useStore.getState().addSharedMoveFromSnapshot(serverMoveId, snap);
    return { status: 'joined' };
  } catch (e) {
    const message =
      e instanceof ApiError && FRIENDLY[e.code] ? FRIENDLY[e.code] : 'Could not join this move.';
    return { status: 'error', message };
  }
}

/** Invite deep link (tuck://invite?token=…): signs in if needed, joins the move, opens it. */
export default function InviteAccept() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [outcome, setOutcome] = useState<Outcome>({ status: 'working' });

  useEffect(() => {
    let cancelled = false;
    void joinMove(token).then((result) => {
      if (cancelled) return;
      if (result.status === 'joined') router.replace(routes.tabs);
      else setOutcome(result);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <View style={styles.center}>
      {outcome.status === 'working' ? <ActivityIndicator color={colors.brand} /> : null}
      <Text style={styles.text}>{outcome.status === 'error' ? outcome.message : 'Joining…'}</Text>
      {outcome.status === 'error' ? (
        <Button onPress={() => router.replace(routes.moves)}>Back to moves</Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: colors.surfaceApp,
  },
  text: { fontFamily: fonts.body.bold, fontSize: 15, color: colors.textBody, textAlign: 'center' },
});
