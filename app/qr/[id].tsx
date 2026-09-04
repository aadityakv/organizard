// app/qr/[id].tsx — QRScreen
// Full-screen modal showing a box's scannable QR label on warm cream.
// Anyone on the move can scan it to open the box. Read-only for every role.

import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import { Icon } from '@/components';
import { boxById, roomById, useStore } from '@/store/useStore';
import { encodeBoxQR } from '@/lib/qr/codes';
import { boxColor, colors, fonts, fontSize, palette, radius, shadow, space, tap, type } from '@/theme';
import { copy } from '@/copy/box';

/** Full-screen QR label for one box, for scanning from another device. */
export default function QRScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const box = useStore((s) => boxById(s, id));
  const room = useStore((s) => (box ? roomById(s, box.roomId) : undefined));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Icon name="x" size={22} color={colors.textBody} />
        </Pressable>

        {box ? (
          <View style={styles.center}>
            <View style={[styles.dot, { backgroundColor: boxColor(box.color) }]} />
            <Text style={styles.number}>Box #{box.number}</Text>
            <Text style={styles.subtitle}>
              {box.name}
              {room ? ` · ${room.name}` : ''}
            </Text>

            <View style={styles.qrCard}>
              <QRCode
                value={encodeBoxQR(box.id)}
                size={232}
                color={colors.textStrong}
                backgroundColor={palette.white}
              />
            </View>

            <View style={styles.hint}>
              <Icon name="info" size={15} color={colors.textPlaceholder} />
              <Text style={styles.hintText}>{copy.qrScreenHint}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.center}>
            <View style={[styles.dot, { backgroundColor: colors.borderStrong }]} />
            <Text style={styles.number}>{copy.boxNotFoundHeader}</Text>
            <Text style={styles.subtitle}>{copy.qrBoxMissingBody}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceApp,
  },
  body: {
    flex: 1,
    paddingHorizontal: space[6],
  },
  close: {
    position: 'absolute',
    top: space[2],
    right: space[5],
    zIndex: 10,
    width: tap.md,
    height: tap.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.85,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: radius.pill,
    marginBottom: space[3],
  },
  number: {
    ...type.screenTitle,
    fontFamily: fonts.display.bold,
    fontSize: fontSize.xl,
    color: colors.textStrong,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: space[1],
    marginBottom: space[5],
    textAlign: 'center',
  },
  qrCard: {
    backgroundColor: palette.white,
    padding: space[5],
    borderRadius: radius.xl,
    ...shadow.md,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginTop: space[5],
    paddingHorizontal: space[6],
  },
  hintText: {
    flexShrink: 1,
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
