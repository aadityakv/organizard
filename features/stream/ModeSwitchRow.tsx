// Stream view header row: back to single capture, and the Photos on/off switch.
// Both are inert while the mic is listening.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components';
import { colors, fonts, alpha, palette } from '@/theme';

type Props = {
  voiceMode: boolean;
  listening: boolean;
  onBackToCapture: () => void;
  onToggleVoiceMode: () => void;
};

/** Row to leave stream view or toggle photos on/off. */
export function ModeSwitchRow({ voiceMode, listening, onBackToCapture, onToggleVoiceMode }: Props) {
  return (
    <View style={styles.streamSwitchRow}>
      <Pressable
        accessibilityRole="button"
        onPress={() => !listening && onBackToCapture()}
        style={styles.backPill}
        accessibilityLabel="Single item"
      >
        <Icon name="chevron-left" size={15} color="#fff" />
        <Text style={styles.backPillText}>Single item</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => !listening && onToggleVoiceMode()}
        style={styles.switchBtn}
      >
        <Icon
          name={voiceMode ? 'camera-off' : 'camera'}
          size={17}
          color={voiceMode ? alpha(palette.white, 0.55) : palette.white}
        />
        <Text style={styles.switchLabel}>{voiceMode ? 'Photos off' : 'Photos on'}</Text>
        <View
          style={[styles.track, { backgroundColor: voiceMode ? alpha(palette.white, 0.25) : colors.brand }]}
        >
          <View style={[styles.knob, { left: voiceMode ? 3 : 19 }]} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  streamSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 38,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 999,
    backgroundColor: alpha(palette.white, 0.14),
  },
  backPillText: { color: palette.white, fontFamily: fonts.body.extra, fontSize: 13 },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: alpha(palette.white, 0.14),
    borderRadius: 999,
    paddingVertical: 8,
    paddingLeft: 15,
    paddingRight: 10,
  },
  switchLabel: { color: palette.white, fontFamily: fonts.body.extra, fontSize: 13 },
  track: { width: 40, height: 24, borderRadius: 999, justifyContent: 'center' },
  knob: {
    position: 'absolute',
    top: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.white,
  },
});
