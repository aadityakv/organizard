// RoomGlyph — a room icon inside a small rounded tile tinted with the room's
// box-palette hue. Legacy rooms (persisted before `color` existed) rehydrate
// without a color, so we coalesce to 'slate' rather than the green fallback.
import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { boxColor, boxTint, radius } from '@/theme';
import { Icon } from './Icon';

export type RoomGlyphProps = {
  icon: string;
  color?: string; // box-palette hue name; defaults to 'slate'
  size?: number; // tile side length, default 32
  style?: StyleProp<ViewStyle>;
};

/** Room icon on a tinted rounded square, keyed by the room color. */
export function RoomGlyph({ icon, color, size = 32, style }: RoomGlyphProps) {
  const hue = color ?? 'slate';
  const iconSize = Math.round(size * 0.56);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: boxTint(hue),
        },
        style,
      ]}
    >
      <Icon name={icon} size={iconSize} color={boxColor(hue)} />
    </View>
  );
}
