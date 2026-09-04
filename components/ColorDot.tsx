// ColorDot: one swatch of the 12-hue box palette, used in every colour picker (add box,
// edit box, room, status and marker sheets). Plain circle when unselected; when
// `selected`, a white gap ring plus an outer ring in the same hue. With `onPress` it
// becomes a Pressable whose hit area is padded up to 44pt regardless of `size`.
import React from 'react';
import { Pressable, StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { boxColor, palette, tap, DEFAULT_HUE, alpha } from '@/theme';

export type ColorDotProps = {
  /** One of the 12 box-palette hue names, e.g. "green", "coral". */
  color: string;
  /** Diameter in logical pixels. @default 24 */
  size?: number;
  /** Picker selected state — adds a white gap ring then an outer colour ring. */
  selected?: boolean;
  /** When provided the dot becomes a Pressable with a tap target ≥ 44 pt. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Box-hue swatch circle; interactive with a selection ring when onPress is given. */
export function ColorDot({
  color = DEFAULT_HUE,
  size = 24,
  selected = false,
  onPress,
  style,
}: ColorDotProps) {
  const solid = boxColor(color);

  const gapSize = size + 4;
  const ringSize = size + 8;

  const dot = (
    <View style={[styles.root, style]}>
      {selected ? (
        <View
          style={{
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderWidth: 2,
            borderColor: solid,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
          }}
        >
          <View
            style={{
              width: gapSize,
              height: gapSize,
              borderRadius: gapSize / 2,
              backgroundColor: palette.white,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: solid,
              }}
            />
          </View>
        </View>
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: solid,
            borderWidth: 1,
            borderColor: alpha(palette.black, 0.06),
          }}
        />
      )}
    </View>
  );

  if (!onPress) {
    return dot;
  }

  // Ensure the tap target is always at least 44 pt
  const hitSize = Math.max(ringSize + 4, tap.min);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        {
          width: hitSize,
          height: hitSize,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Select ${color} color`}
      accessibilityState={{ selected }}
    >
      {dot}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
