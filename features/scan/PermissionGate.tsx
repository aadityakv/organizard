// Shown instead of the viewfinder until camera access is granted.
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, SlothMark } from '@/components';
import { copy } from '@/copy/scan';
import { colors, fonts, palette, radius, space } from '@/theme';

/** Camera permission prompt, with a Settings shortcut once access has been refused. */
export function PermissionGate({ denied, onRequest }: { denied: boolean; onRequest: () => void }) {
  return (
    <SafeAreaView style={styles.permSafe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.permContent} showsVerticalScrollIndicator={false}>
        <View style={styles.permIconWrap}>
          <SlothMark size={56} />
        </View>
        <Text style={styles.permTitle}>{copy.permissionTitle}</Text>
        <Text style={styles.permBody}>{copy.permissionBody}</Text>
        {denied ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            iconLeft="settings"
            onPress={() => Linking.openSettings()}
          >
            {copy.openSettingsButton}
          </Button>
        ) : (
          <Button variant="primary" size="lg" fullWidth iconLeft="camera" onPress={onRequest}>
            {copy.enableCameraButton}
          </Button>
        )}
        {denied && <Text style={styles.permHint}>{copy.permissionDeniedBody}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

/** QR scanner with the four result states: this move, another move, no access, unknown code. */

const styles = StyleSheet.create({
  permSafe: { flex: 1, backgroundColor: colors.surfaceApp },
  permContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space[6],
    gap: space[3],
  },
  permIconWrap: {
    width: 96,
    height: 96,
    borderRadius: radius['2xl'],
    backgroundColor: colors.brandWash,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2],
  },
  permTitle: {
    fontFamily: fonts.display.bold,
    fontSize: 24,
    color: palette.ink900,
    textAlign: 'center',
  },
  permBody: {
    fontFamily: fonts.body.semibold,
    fontSize: 15,
    color: palette.ink500,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: space[3],
    paddingHorizontal: space[2],
  },
  permHint: {
    fontFamily: fonts.body.semibold,
    fontSize: 13,
    color: palette.ink400,
    textAlign: 'center',
    marginTop: space[2],
  },
});
