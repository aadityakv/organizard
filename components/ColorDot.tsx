import React from 'react';
import { Pressable, StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { boxColor, palette, tap } from '@/theme';

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

/**
 * ColorDot — a solid box-hue swatch circle.
 *
 * Non-interactive: renders a plain View.
 * Interactive (onPress provided): wraps in a Pressable with a pressed-state
 * scale animation and a minimum 44-pt hit area.
 *
 * Selected state replicates the CSS
 *   box-shadow: 0 0 0 2px white, 0 0 0 4px <solid>
 * by nesting three views:
 *   [outer ring — solid colour, 2 pt thick]
 *     [white gap ring — 2 pt thick]
 *       [inner circle — solid colour]
 */
export function ColorDot({ color = 'green', size = 24, selected = false, onPress, style }: ColorDotProps) {
  const solid = boxColor(color);

  // Dimensions for the layered ring construction.
  // Inner circle:  size × size
  // White gap:     size + 4  (+2 on each side)
  // Outer ring:    size + 8  (+2 on each side)
  const gapSize = size + 4; // 2 pt white gap on each side
  const ringSize = size + 8; // 2 pt colour ring on each side

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
        // Unselected: plain circle with a subtle inset hairline
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: solid,
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.06)',
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
