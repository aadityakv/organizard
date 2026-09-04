// RoleBadge — surfaces a member's permission level in plain language.
// owner = brand green, editor = info blue, viewer = muted/neutral tones.
// Compact pill (default) or expanded row with blurb when withBlurb=true.
import React from 'react';
import { StyleSheet, View, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, palette, radius, space, fonts, fontSize } from '@/theme';
import { ROLE_LABEL, ROLE_BLURB, ROLE_ICON } from '@/lib/permissions';
import type { Role } from '@/data/types';
import { Icon } from '@/components/Icon';

export type RoleBadgeProps = {
  role: Role;
  size?: 'sm' | 'md';
  withBlurb?: boolean;
  style?: StyleProp<ViewStyle>;
};

type RoleTokens = {
  iconColor: string;
  wash: string;
  labelColor: string;
  blurbColor: string;
};

const ROLE_TOKENS: Record<Role, RoleTokens> = {
  owner: {
    iconColor: palette.green700,
    wash: palette.green50,
    labelColor: palette.green700,
    blurbColor: palette.green600,
  },
  editor: {
    iconColor: palette.blue600,
    wash: palette.blue50,
    labelColor: palette.blue600,
    blurbColor: palette.blue500,
  },
  viewer: {
    iconColor: palette.ink500,
    wash: palette.cream200,
    labelColor: palette.ink500,
    blurbColor: palette.ink400,
  },
};
/** Member role as a colored pill, or a row with a plain-language blurb. */
export function RoleBadge({ role, size = 'md', withBlurb = false, style }: RoleBadgeProps) {
  const tokens = ROLE_TOKENS[role] ?? ROLE_TOKENS.viewer;
  const label = ROLE_LABEL[role];
  const blurb = ROLE_BLURB[role];
  const iconName = ROLE_ICON[role];

  const isSm = size === 'sm';

  if (withBlurb) {
    const circleSize = isSm ? 28 : 36;
    const iconSize = isSm ? 13 : 16;

    return (
      <View style={[styles.row, style]}>
        <View
          style={[
            styles.iconCircle,
            {
              width: circleSize,
              height: circleSize,
              borderRadius: circleSize / 2,
              backgroundColor: tokens.wash,
            },
          ]}
        >
          <Icon name={iconName} size={iconSize} color={tokens.iconColor} strokeWidth={2.2} />
        </View>

        <View style={styles.textStack}>
          <Text
            style={[styles.rowLabel, isSm && styles.rowLabelSm, { color: colors.textStrong }]}
            numberOfLines={1}
          >
            {label}
          </Text>
          <Text
            style={[styles.rowBlurb, isSm && styles.rowBlurbSm, { color: tokens.blurbColor }]}
            numberOfLines={2}
          >
            {blurb}
          </Text>
        </View>
      </View>
    );
  }

  const pillHeight = isSm ? 22 : 26;
  const pillPaddingH = isSm ? space[2] : 11;
  const pillPaddingIconH = isSm ? space[2] : 9;
  const iconSize = isSm ? 12 : 14;

  return (
    <View
      style={[
        styles.pill,
        {
          height: pillHeight,
          paddingLeft: pillPaddingIconH,
          paddingRight: pillPaddingH,
          backgroundColor: tokens.wash,
        },
        style,
      ]}
    >
      <Icon name={iconName} size={iconSize} color={tokens.iconColor} strokeWidth={2.2} />
      <Text
        style={[styles.pillLabel, isSm && styles.pillLabelSm, { color: tokens.labelColor }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: radius.pill,
  },
  pillLabel: {
    fontFamily: fonts.body.extra,
    fontSize: fontSize.xs,
    lineHeight: 14,
    includeFontPadding: false,
  },
  pillLabelSm: {
    fontSize: fontSize['2xs'],
    lineHeight: 13,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textStack: {
    flex: 1,
    flexDirection: 'column',
    gap: 1,
  },
  rowLabel: {
    fontFamily: fonts.body.extra,
    fontSize: fontSize.sm,
    lineHeight: 18,
    includeFontPadding: false,
  },
  rowLabelSm: {
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  rowBlurb: {
    fontFamily: fonts.body.semibold,
    fontSize: fontSize.xs,
    lineHeight: 16,
    includeFontPadding: false,
  },
  rowBlurbSm: {
    fontSize: fontSize['2xs'],
    lineHeight: 14,
  },
});
