// Big-number stat with caption.
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';

import { colors, fonts, fontSize } from '@/theme';

export type ValueStatProps = {
  /** The big number/string displayed prominently, e.g. "$4,210" or 18. */
  value: string | number;
  /** Caption label beneath the value, e.g. "Estimated value". */
  label: string;
  /** 'brand' = green value (for the headline figure); 'default' = ink. */
  tone?: 'default' | 'brand';
  style?: StyleProp<ViewStyle>;
};

/** Big-number stat with a caption, used for totals and estimated value. */
export function ValueStat({ value, label, tone = 'default', style }: ValueStatProps) {
  const valueColor = tone === 'brand' ? colors.success : colors.textStrong;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
          {String(value)}
        </Text>
      </View>

      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    fontFamily: fonts.display.bold,
    fontSize: fontSize['2xl'],
    lineHeight: 34,
    includeFontPadding: false,
  },
  label: {
    fontFamily: fonts.body.extra,
    fontSize: fontSize.xs,
    lineHeight: 16,
    color: colors.textMuted,
    includeFontPadding: false,
  },
});
