// Button: the app's one text button. Four variants (primary green, secondary outlined,
// ghost, danger), three sizes, optional leading/trailing Lucide icons, fullWidth, and a
// scale-down on press. `sm` keeps a 44pt hit area even though it draws at 36.
// Every CTA in sheets, footers and empty states goes through this component.
import React from 'react';
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Animated,
  type PressableStateCallbackType,
} from 'react-native';

import { colors, palette, radius, shadow, fonts, fontSize, tap, motion } from '@/theme';
import { Icon } from '@/components/Icon';

export type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  iconLeft?: string;
  iconRight?: string;
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

type SizeConfig = {
  height: number;
  paddingHorizontal: number;
  fontSize: number;
  gap: number;
  iconSize: number;
};

const sizes: Record<NonNullable<ButtonProps['size']>, SizeConfig> = {
  sm: { height: 36, paddingHorizontal: 14, fontSize: fontSize.sm, gap: 6, iconSize: 16 },
  md: { height: 44, paddingHorizontal: 18, fontSize: fontSize.base, gap: 8, iconSize: 18 },
  lg: { height: 52, paddingHorizontal: 22, fontSize: fontSize.md, gap: 9, iconSize: 20 },
};

type VariantConfig = {
  bg: string;
  bgPressed: string;
  textColor: string;
  borderColor: string;
  borderWidth: number;
  shadowStyle: ViewStyle;
};

const variants: Record<NonNullable<ButtonProps['variant']>, VariantConfig> = {
  primary: {
    bg: colors.brand,
    bgPressed: colors.brandPressed,
    textColor: colors.textOnBrand,
    borderColor: 'transparent',
    borderWidth: 0,
    shadowStyle: shadow.brand as ViewStyle,
  },
  secondary: {
    bg: palette.white,
    bgPressed: palette.cream200,
    textColor: palette.ink900,
    borderColor: palette.sand300,
    borderWidth: 1.5,
    shadowStyle: shadow.sm as ViewStyle,
  },
  ghost: {
    bg: 'transparent',
    bgPressed: palette.green50,
    textColor: palette.green700,
    borderColor: 'transparent',
    borderWidth: 0,
    shadowStyle: {},
  },
  danger: {
    bg: colors.danger,
    bgPressed: palette.red600,
    textColor: palette.white,
    borderColor: 'transparent',
    borderWidth: 0,
    shadowStyle: {},
  },
};

/** Primary action button with variants, sizes, optional icons and press feedback. */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  iconLeft,
  iconRight,
  onPress,
  children,
  style,
}: ButtonProps) {
  const sizeConfig = sizes[size];
  const variantConfig = variants[variant];

  const [scale] = React.useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    if (disabled) return;
    Animated.timing(scale, {
      toValue: motion.pressScale,
      duration: motion.pressInMs,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: motion.pressOutMs,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[fullWidth && styles.fullWidth, { transform: [{ scale }] }, style]}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        style={({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
          styles.base,
          {
            height: sizeConfig.height,
            paddingHorizontal: sizeConfig.paddingHorizontal,
            gap: sizeConfig.gap,
            backgroundColor: pressed && !disabled ? variantConfig.bgPressed : variantConfig.bg,
            borderColor: variantConfig.borderColor,
            borderWidth: variantConfig.borderWidth,
          } as ViewStyle,
          // Tap target: md and lg are already ≥44px; sm (36px) gets minHeight 44 for the hit area
          size === 'sm' ? styles.smTapTarget : undefined,
          !disabled ? variantConfig.shadowStyle : undefined,
          disabled ? styles.disabled : undefined,
          fullWidth ? styles.fullWidthPressable : undefined,
        ]}
      >
        {iconLeft && (
          <View
            style={{
              width: sizeConfig.iconSize,
              height: sizeConfig.iconSize,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              name={iconLeft}
              size={sizeConfig.iconSize}
              color={variantConfig.textColor}
              strokeWidth={2}
            />
          </View>
        )}

        <Text
          style={[
            styles.label,
            {
              fontSize: sizeConfig.fontSize,
              color: variantConfig.textColor,
            },
          ]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {children}
        </Text>

        {iconRight && (
          <View
            style={{
              width: sizeConfig.iconSize,
              height: sizeConfig.iconSize,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              name={iconRight}
              size={sizeConfig.iconSize}
              color={variantConfig.textColor}
              strokeWidth={2}
            />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    // overflow: hidden keeps the pill shape clean on Android
    overflow: 'hidden',
  },
  smTapTarget: {
    minHeight: tap.min,
  },
  label: {
    fontFamily: fonts.body.bold,
    letterSpacing: 0.1,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  fullWidth: {
    width: '100%',
  },
  fullWidthPressable: {
    width: '100%',
  },
});
