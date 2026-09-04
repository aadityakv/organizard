// Capture view (free single item): the "Switch to Stream" pill, the viewfinder, and
// one shutter. Snap → name it in Add-item, one at a time.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, ProBadge } from '@/components';
import { colors, fonts, palette, alpha } from '@/theme';

import { sharedStyles } from './styles';
import { Viewfinder } from './Viewfinder';
import { copy } from '@/copy/stream';

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
          <Text style={styles.streamPillText}>{copy.switchToStreamButton}</Text>
          {!isPro ? <ProBadge label={copy.proBadge} /> : null}
          <Icon name="chevron-right" size={16} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>
      <Viewfinder mode="frame" hint={copy.captureHint} />
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
    backgroundColor: alpha(palette.white, 0.14),
  },
  streamPillText: { color: palette.white, fontFamily: fonts.body.extra, fontSize: 14.5 },
  captureBottom: { position: 'absolute', left: 0, right: 0, bottom: 36, alignItems: 'center' },
});
