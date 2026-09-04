// StatusChip: a box's lifecycle status (Packing, Sealed, In transit, Unpacked, or a
// custom one) as a coloured pill. The colour is the status's palette hue, so custom
// statuses look native. Used on BoxCard, the box hero and the status sheet.
import { StyleSheet, View, Text, StyleProp, ViewStyle } from 'react-native';
import { boxColor, boxTint, colors, radius, fonts, fontSize } from '@/theme';

export type StatusChipProps = {
  label: string;
  color: string;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};

/** Colored pill showing a box status label. */
export function StatusChip({ label, color, size = 'md', style }: StatusChipProps) {
  const isSm = size === 'sm';

  const pillStyle = {
    height: isSm ? 20 : 24,
    paddingHorizontal: isSm ? 8 : 11,
    backgroundColor: boxTint(color),
  };

  const dotStyle = {
    width: isSm ? 7 : 8,
    height: isSm ? 7 : 8,
    borderRadius: isSm ? 3.5 : 4,
    backgroundColor: boxColor(color),
  };

  const textStyle = {
    fontSize: isSm ? fontSize['2xs'] : fontSize.xs,
  };

  return (
    <View style={[styles.pill, pillStyle, style]}>
      <View style={[styles.dot, dotStyle]} />
      <Text style={[styles.label, textStyle]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  dot: {
    flexShrink: 0,
  },
  label: {
    fontFamily: fonts.body.bold,
    color: colors.textStrong,
    lineHeight: 14,
    includeFontPadding: false,
  },
});
