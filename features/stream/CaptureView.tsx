// Capture view (free single item): the "Switch to Stream" pill, the viewfinder, and
// one shutter. Snap → name it in Add-item, one at a time.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components';
import { colors, fonts, palette } from '@/theme';

import { sharedStyles } from './styles';
import { Viewfinder } from './Viewfinder';

type Props = {
  isPro: boolean;
  onSwitchToStream: () => void;
  onCapture: () => void;
};

/** Free single-item capture view with the gated "Switch to Stream" pill. */
export function CaptureView({ isPro, onSwitchToStream, onCapture }: Props) {
  return (
    <>
      <View style={styles.captureSwitchWrap}>
        <Pressable onPress={onSwitchToStream} style={styles.streamPill} accessibilityLabel="Switch to Stream">
          <Icon name="zap" size={17} color={colors.brand} />
          <Text style={styles.streamPillText}>Switch to Stream</Text>
          {!isPro ? (
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          ) : null}
          <Icon name="chevron-right" size={16} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>
      <Viewfinder mode="frame" hint="Snap an item, then name it" />
      <View style={styles.captureBottom}>
        <Pressable onPress={onCapture} style={sharedStyles.shutter} accessibilityLabel="Capture">
          <Icon name="camera" size={30} color="#fff" />
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  captureSwitchWrap: { marginTop: 12, paddingHorizontal: 16 },
  streamPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  streamPillText: { color: '#fff', fontFamily: fonts.body.extra, fontSize: 14.5 },
  proBadge: {
    backgroundColor: palette.amber400,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  proBadgeText: { fontSize: 10, fontFamily: fonts.body.extra, color: palette.ink900, letterSpacing: 0.3 },
  captureBottom: { position: 'absolute', left: 0, right: 0, bottom: 36, alignItems: 'center' },
});
