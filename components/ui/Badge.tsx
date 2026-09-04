// Badge: a small tonal pill for short status words ("Archived", "3 to fix").
// Six tones (neutral / brand / success / warning / danger / info) map to the semantic
// wash + text colour pairs in the theme; two sizes. Display-only — for a tappable
// pill use MarkerChip, for box lifecycle use StatusChip.
import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { colors, palette, radius, fonts, fontSize } from '@/theme';
export type BadgeProps = {
  label: string;
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};
const TONES: Record<NonNullable<BadgeProps['tone']>, { bg: string; text: string }> = {
  neutral: { bg: palette.cream200, text: palette.ink700 },
  brand: { bg: colors.brandWash, text: palette.green700 },
  success: { bg: colors.successWash, text: palette.green700 },
  warning: { bg: colors.warningWash, text: palette.amber600 },
  danger: { bg: colors.dangerWash, text: palette.red600 },
  info: { bg: colors.infoWash, text: palette.blue600 },
};
/** Small tonal label pill. */
export function Badge({ label, tone = 'neutral', size = 'md', style }: BadgeProps): React.JSX.Element {
  const toneStyle = TONES[tone] ?? TONES.neutral;
  const sizeStyle = size === 'sm' ? styles.containerSm : styles.containerMd;
  const textSizeStyle = size === 'sm' ? styles.textSm : styles.textMd;

  return (
    <View style={[styles.base, sizeStyle, { backgroundColor: toneStyle.bg }, style]}>
      <Text style={[textSizeStyle, { color: toneStyle.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  containerSm: {
    height: 18,
    paddingHorizontal: 8,
  },

  containerMd: {
    height: 22,
    paddingHorizontal: 10,
  },

  textSm: {
    fontFamily: fonts.body.extra,
    fontSize: fontSize['2xs'],
    lineHeight: 14,
    letterSpacing: 0.1,
  },

  textMd: {
    fontFamily: fonts.body.extra,
    fontSize: fontSize.xs,
    lineHeight: 16,
    letterSpacing: 0.1,
  },
});
