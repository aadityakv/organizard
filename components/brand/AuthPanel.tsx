// Reusable sign-in / sign-up panel: Sign in with Apple + email/password (Log in or
// Sign up). Used by the onboarding sign-in screen and the Share tab. On success it
// calls onAuthed (the parent decides where to go; the Share tab just re-renders).
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import { ApiError } from '@/lib/api';
import { appleSignInAvailable, loginWithEmail, registerWithEmail, signInWithApple } from '@/services/auth';
import { fonts, palette } from '@/theme';
import { copy } from '@/copy/shared';

const AUTH_MODE = { login: 'login', signup: 'signup' } as const;
type AuthMode = (typeof AUTH_MODE)[keyof typeof AUTH_MODE];

const FRIENDLY: Record<string, string> = {
  EMAIL_TAKEN: 'An account with that email already exists. Try logging in instead.',
  INVALID_CREDENTIALS: 'That email or password is incorrect.',
  WEAK_PASSWORD: 'Please use a password of at least 8 characters.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  RATE_LIMITED: 'Too many attempts. Please wait a few minutes and try again.',
};
function friendly(e: unknown): string {
  if (e instanceof ApiError && FRIENDLY[e.code]) return FRIENDLY[e.code];
  return e instanceof Error ? e.message : 'Something went wrong.';
}

/** Sign-in form: Sign in with Apple plus email/password login or registration. */
export function AuthPanel({
  title = 'Sign in',
  subtitle,
  onAuthed,
}: {
  title?: string;
  subtitle?: string;
  onAuthed?: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>(AUTH_MODE.login);
  const [busy, setBusy] = useState(false);
  const [appleOk, setAppleOk] = useState(false);

  useEffect(() => {
    appleSignInAvailable()
      .then(setAppleOk)
      .catch(() => {});
  }, []);

  const run = async (fn: () => Promise<void>, label: string) => {
    setBusy(true);
    try {
      await fn();
      onAuthed?.();
    } catch (e) {
      Alert.alert(label, friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = () =>
    run(
      async () => {
        const e = email.trim();
        if (authMode === AUTH_MODE.signup) await registerWithEmail(e, password);
        else await loginWithEmail(e, password);
      },
      authMode === AUTH_MODE.signup ? 'Could not create account' : 'Could not sign in',
    );

  return (
    <Card style={styles.card}>
      <Text style={styles.h}>{title}</Text>
      {subtitle ? <Text style={styles.p}>{subtitle}</Text> : null}
      {appleOk ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={999}
          style={styles.appleBtn}
          onPress={() => run(signInWithApple, 'Sign-in failed')}
        />
      ) : null}
      <Text style={styles.or}>{copy.orUseEmail}</Text>
      <Segmented
        options={[
          { value: AUTH_MODE.login, label: 'Log in' },
          { value: AUTH_MODE.signup, label: 'Sign up' },
        ]}
        value={authMode}
        onChange={(v) => setAuthMode(v as AuthMode)}
      />
      <View style={styles.fields}>
        <Input
          value={email}
          onChangeText={setEmail}
          placeholder={copy.youEmailCom}
          keyboardType="email-address"
          autoCapitalize="none"
          textContentType="emailAddress"
        />
        <Input
          value={password}
          onChangeText={setPassword}
          placeholder={copy.password}
          secureTextEntry
          autoCapitalize="none"
          textContentType={authMode === AUTH_MODE.signup ? 'newPassword' : 'password'}
        />
      </View>
      <Button
        onPress={submitEmail}
        disabled={busy || !email.trim() || password.length < 8}
        fullWidth
        style={styles.cta}
      >
        {authMode === AUTH_MODE.signup ? 'Create account' : 'Log in'}
      </Button>
      {authMode === AUTH_MODE.signup ? <Text style={styles.hint}>{copy.useAtLeast8Characters}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 8 },
  h: { fontFamily: fonts.display.bold, fontSize: 20, color: palette.ink900 },
  p: { fontFamily: fonts.body.semibold, fontSize: 14, color: palette.ink500, lineHeight: 20 },
  appleBtn: { height: 48, marginTop: 6 },
  or: {
    fontFamily: fonts.body.bold,
    fontSize: 12,
    color: palette.ink400,
    textAlign: 'center',
    marginVertical: 6,
  },
  fields: { gap: 8, marginTop: 8 },
  cta: { marginTop: 12 },
  hint: {
    fontFamily: fonts.body.semibold,
    fontSize: 12,
    color: palette.ink400,
    textAlign: 'center',
    marginTop: 6,
  },
});
