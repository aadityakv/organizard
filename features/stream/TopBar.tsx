// Top bar: close (X), the target-box chip, and the torch toggle when the camera is live.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components';
import { boxColor, fonts, palette } from '@/theme';

import { boxLabel, type BoxRef } from './types';

type Props = {
  box: BoxRef | undefined;
  cameraOn: boolean;
  torch: boolean;
  onClose: () => void;
  onPickBox: () => void;
  onToggleTorch: () => void;
};

export function TopBar({ box, cameraOn, torch, onClose, onPickBox, onToggleTorch }: Props) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onClose} accessibilityLabel="End session" style={styles.iconBtn}>
        <Icon name="x" size={19} color="#fff" />
      </Pressable>
      <Pressable onPress={onPickBox} style={styles.boxChip}>
        <View style={[styles.dot, { backgroundColor: boxColor(box?.color ?? 'green') }]} />
        <Text style={styles.boxChipText} numberOfLines={1}>
          {boxLabel(box)}
        </Text>
        <Icon name="chevron-down" size={15} color="rgba(255,255,255,0.8)" />
      </Pressable>
      {cameraOn ? (
        <Pressable
          onPress={onToggleTorch}
          style={[styles.iconBtn, torch && styles.iconBtnOn]}
          accessibilityLabel={torch ? 'Flash on' : 'Flash off'}
        >
          <Icon name="zap" size={17} color={torch ? palette.ink900 : '#fff'} />
        </Pressable>
      ) : (
        <View style={styles.iconBtn} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnOn: { backgroundColor: palette.amber400 },
  boxChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    maxWidth: 220,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  boxChipText: { color: '#fff', fontFamily: fonts.body.bold, fontSize: 13.5, flexShrink: 1 },
});
