// Big-number stat with caption.
import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';

import { colors, fonts, fontSize, space } from '@/theme';
import { Icon } from '@/components/Icon';

export type ValueStatProps = {
  /** The big number/string displayed prominently, e.g. "$4,210" or 18. */
  value: string | number;
  /** Caption label beneath the value, e.g. "Estimated value". */
  label: string;
  /** Optional Lucide icon name (kebab-case) shown beside the value. */
  icon?: string;
  /** 'brand' = green value (for the headline figure); 'default' = ink. */
  tone?: 'default' | 'brand';
  /** Horizontal alignment of content. @default 'left' */
  align?: 'left' | 'center';
  style?: StyleProp<ViewStyle>;
};

/** Big-number stat with a caption, used for totals and estimated value. */
export function ValueStat({ value, label, icon, tone = 'default', align = 'left', style }: ValueStatProps) {
  const isBrand = tone === 'brand';
  const valueColor = isBrand ? colors.success : colors.textStrong;
  const alignItems = align === 'center' ? 'center' : 'flex-start';

  return (
    <View style={[styles.container, { alignItems }, style]}>
      <View style={[styles.valueRow, { justifyContent: alignItems as 'center' | 'flex-start' }]}>
        {icon ? <Icon name={icon} size={20} color={valueColor} strokeWidth={2.5} /> : null}
        <Text
          style={[styles.value, { color: valueColor, marginLeft: icon ? space[1] : 0 }]}
          numberOfLines={1}
        >
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
    // type.numeral = Fredoka_700Bold, fontSize 30, lineHeight not set (defaults to auto)
    fontFamily: fonts.display.bold,
    fontSize: fontSize['2xl'], // 30
    lineHeight: 34,
    includeFontPadding: false,
  },
  label: {
    fontFamily: fonts.body.extra, // Nunito_800ExtraBold — matches the bold eyebrow feel
    fontSize: fontSize.xs, // 12
    lineHeight: 16,
    color: colors.textMuted,
    includeFontPadding: false,
  },
});
