// Account sheet on the library: signed-in users can sign out or delete their
// account; guests are offered sign-in (their moves stay on-device until then).
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Avatar, Button, Sheet } from '@/components';
import { deleteAccount } from '@/services/auth';
import { flushAndSignOut } from '@/services/share';
import { useStore } from '@/store/useStore';
import { fonts, palette } from '@/theme';
import { routes } from '@/lib/routes';
import { copy } from '@/copy/moves';

/** Account sheet: who is signed in, sign out, and account deletion. */
export function AccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const account = useStore((s) => s.account);
  const session = useStore((s) => s.session);

  const onDeleteAccount = () =>
    Alert.alert(copy.deleteAccountConfirmTitle, copy.deleteAccountConfirmBody, [
      { text: copy.cancelButton, style: 'cancel' },
      {
        text: copy.deleteButton,
        style: 'destructive',
        onPress: () => {
          onClose();
          deleteAccount().catch((e) =>
            Alert.alert(
              copy.deleteAccountFailedTitle,
              e instanceof Error ? e.message : 'Something went wrong.',
            ),
          );
        },
      },
    ]);

  return (
    <Sheet visible={visible} onClose={onClose} title={copy.accountTitle}>
      <View style={styles.accountSheet}>
        {session ? (
          <>
            <View style={styles.accountRow}>
              <Avatar name={account?.name ?? 'You'} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.accountSheetName} numberOfLines={1}>
                  {account?.name ?? 'You'}
                </Text>
                {account?.email ? (
                  <Text style={styles.accountSheetEmail} numberOfLines={1}>
                    {account.email}
                  </Text>
                ) : null}
              </View>
            </View>
            <Button
              variant="secondary"
              fullWidth
              iconLeft="log-out"
              onPress={() => {
                onClose();
                void flushAndSignOut().then(() => router.replace(routes.welcome));
              }}
            >
              Sign out
            </Button>
            <Button variant="danger" fullWidth iconLeft="trash-2" onPress={onDeleteAccount}>
              {copy.deleteAccountButton}
            </Button>
          </>
        ) : (
          <>
            <Text style={styles.guestNote}>{copy.guestAccountNote}</Text>
            <Button
              fullWidth
              iconLeft="log-in"
              onPress={() => {
                onClose();
                router.push(routes.signIn);
              }}
            >
              Log in or sign up
            </Button>
          </>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  accountSheet: { gap: 12, paddingBottom: 8 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 4 },
  accountSheetName: { fontFamily: fonts.body.bold, fontSize: 16, color: palette.ink900 },
  accountSheetEmail: { fontFamily: fonts.body.semibold, fontSize: 13, color: palette.ink500 },
  guestNote: { fontFamily: fonts.body.semibold, fontSize: 14, color: palette.ink500, lineHeight: 20 },
});
