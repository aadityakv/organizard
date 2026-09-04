// MarkerChip: a handling marker (Fragile, Open first, Heavy, …) as an icon + label pill
// in the marker's hue. Display-only on cards and rows; with `onPress` it becomes a
// toggle whose `selected` state fills the pill, used in the markers sheet and the
// add-item marker section.
import { Pressable, View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { boxColor, boxTint, colors, radius, fonts, fontSize, alpha, palette } from '@/theme';
import { Icon } from '@/components/Icon';

export type MarkerChipProps = {
  label: string;
  color: string;
  icon: string;
  size?: 'sm' | 'md';
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Handling-marker pill (Fragile, Open first, …) that can be display-only or a toggle. */
export function MarkerChip({
  label,
  color,
  icon,
  size = 'md',
  selected = false,
  onPress,
  style,
}: MarkerChipProps) {
  const isSm = size === 'sm';

  const height = isSm ? 26 : 30;
  const paddingHorizontal = isSm ? 9 : 11;
  const gap = isSm ? 5 : 6;
  const glyphSize = isSm ? 12 : 14;
  const dotSize = isSm ? 6 : 7;
  const labelFontSize = isSm ? fontSize['2xs'] : fontSize.xs;

  const solidHue = boxColor(color);
  const tintWash = boxTint(color);

  const bgColor = selected ? solidHue : tintWash;
  const textColor = selected ? colors.textOnBrand : colors.textStrong;
  const iconColor = selected ? colors.textOnBrand : solidHue;

  const pill = (
    <View
      style={[
        styles.pill,
        {
          height,
          paddingHorizontal,
          gap,
          backgroundColor: bgColor,
          borderColor: selected ? solidHue : 'transparent',
        },
        style,
      ]}
    >
      {icon ? (
        <View style={{ width: glyphSize, height: glyphSize }}>
          <Icon name={icon} size={glyphSize} color={iconColor} strokeWidth={2.5} />
        </View>
      ) : (
        <View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: selected ? alpha(palette.white, 0.85) : solidHue,
            },
          ]}
        />
      )}
      <Text style={[styles.label, { fontSize: labelFontSize, color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) {
    return pill;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      {pill}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  dot: {
    flexShrink: 0,
  },
  label: {
    fontFamily: fonts.body.bold,
    lineHeight: 16,
    includeFontPadding: false,
    flexShrink: 1,
  },
});
