// Icon-only button with a 44pt hit target.
import React from 'react';
import { Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';

import { colors, palette, radius, tap, shadow } from '@/theme';
import { Icon } from '@/components/Icon';
export type IconButtonProps = {
  /** Lucide kebab-case icon name, e.g. "x", "more-horizontal", "camera". */
  icon: string;
  onPress?: () => void;
  /**
   * Visual style:
   *  - plain  — cream-200 background, ink-700 icon (default)
   *  - brand  — green background, white icon (primary action)
   *  - ghost  — transparent background, ink-700 icon (toolbar)
   *  - danger — red wash background, danger-red icon (destructive)
   */
  variant?: 'plain' | 'brand' | 'ghost' | 'danger';
  /** Tap-target size. sm=36px  md=44px  lg=52px */
  size?: 'sm' | 'md' | 'lg';
  /** Required for accessibility since there is no visible text. */
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};
const SIZE_MAP: Record<
  NonNullable<IconButtonProps['size']>,
  { box: number; icon: number; borderRadius: number }
> = {
  sm: { box: tap.sm, icon: 18, borderRadius: radius.sm },
  md: { box: tap.md, icon: 22, borderRadius: radius.md },
  lg: { box: tap.lg, icon: 24, borderRadius: radius.lg },
};
type VariantTokens = {
  bg: string;
  bgPressed: string;
  iconColor: string;
  withShadow?: boolean;
};

const VARIANT_MAP: Record<NonNullable<IconButtonProps['variant']>, VariantTokens> = {
  plain: {
    bg: palette.cream200,
    bgPressed: palette.sand300,
    iconColor: palette.ink700,
  },
  brand: {
    bg: colors.brand,
    bgPressed: colors.brandPressed,
    iconColor: palette.white,
    withShadow: true,
  },
  ghost: {
    bg: 'transparent',
    bgPressed: palette.cream200,
    iconColor: palette.ink700,
  },
  danger: {
    bg: colors.dangerWash,
    bgPressed: palette.red100,
    iconColor: colors.danger,
  },
};
export function IconButton({
  icon,
  onPress,
  variant = 'plain',
  size = 'md',
  accessibilityLabel,
  disabled = false,
  style,
}: IconButtonProps) {
  const sizeTokens = SIZE_MAP[size];
  const variantTokens = VARIANT_MAP[variant];

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          width: sizeTokens.box,
          height: sizeTokens.box,
          borderRadius: sizeTokens.borderRadius,
          backgroundColor: pressed && !disabled ? variantTokens.bgPressed : variantTokens.bg,
          opacity: disabled ? 0.4 : 1,
          transform: [{ scale: pressed && !disabled ? 0.92 : 1 }],
        },
        variantTokens.withShadow && !disabled && styles.brandShadow,
        style,
      ]}
    >
      {({ pressed }) => (
        <Icon
          name={icon}
          size={sizeTokens.icon}
          color={variantTokens.iconColor}
          strokeWidth={pressed && !disabled ? 2.5 : 2}
        />
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandShadow: {
    ...shadow.brand,
  },
});
