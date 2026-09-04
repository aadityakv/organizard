// QR label card: the scannable code plus full-screen and print actions.
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';

import { Button } from '@/components';
import type { Box } from '@/data/types';
import { encodeBoxQR } from '@/lib/qr/codes';
import { printLabels } from '@/services/print';
import { colors, fonts, palette, radius, shadow } from '@/theme';
import { routes } from '@/lib/routes';
import { copy } from '@/copy/box';

/** Card with the box's QR code and actions to view or print the label. */
export function QrLabelCard({ box, roomName }: { box: Box; roomName?: string }) {
  return (
    <View style={styles.qrCard}>
      <View style={styles.qrFrame}>
        <QRCode
          value={encodeBoxQR(box.id)}
          size={104}
          color={palette.ink900}
          backgroundColor={palette.white}
        />
      </View>
      <View style={styles.qrBody}>
        <Text style={styles.qrEyebrow}>Box #{box.number} label</Text>
        <Button
          variant="secondary"
          size="sm"
          iconLeft="scan-line"
          onPress={() => router.push(routes.qr(box.id))}
        >
          {copy.showQrFullScreenButton}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          iconLeft="printer"
          style={styles.qrPrint}
          onPress={() =>
            void printLabels([{ boxId: box.id, number: box.number, name: box.name, room: roomName }])
          }
        >
          Print label
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  qrCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 18,
    ...shadow.sm,
  },
  qrFrame: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: 6,
    borderWidth: 1,
    borderColor: palette.sand300,
  },
  qrBody: { flex: 1, justifyContent: 'center', gap: 8 },
  qrEyebrow: { fontFamily: fonts.body.extra, fontSize: 13, color: palette.ink500 },
  qrPrint: { alignSelf: 'flex-start' },
});
