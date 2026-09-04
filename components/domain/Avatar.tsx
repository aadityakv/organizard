// Avatar: a member's face in rosters and the account sheet (Members, Moves, AccountSheet).
// Shows the photo when a URI is given, otherwise the initials of the display name on a
// box-palette hue. The hue is derived from the name with a stable hash unless `color`
// is passed, so the same person always gets the same colour across screens.
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';

import { boxColor, boxTint, BOX_COLORS, fonts } from '@/theme';
export type AvatarProps = {
  /** Member's display name — used for initials and deterministic color fallback. */
  name: string;
  /** Diameter in px. @default 40 */
  size?: number;
  /** Optional photo URI; falls back to initials when absent. */
  uri?: string;
  /**
   * Box-palette hue name (e.g. "amber", "sky"). When omitted, a hue is
   * derived deterministically from `name` so each person always gets the
   * same warm color.
   */
  color?: string;
  style?: StyleProp<ViewStyle>;
};
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function hueForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return BOX_COLORS[h % BOX_COLORS.length];
}
/** Member avatar: photo when available, otherwise initials on a deterministic color. */
export function Avatar({ name, size = 40, uri, color, style }: AvatarProps) {
  const hue = color ?? hueForName(name);
  const bgColor = boxTint(hue);
  const fgColor = boxColor(hue);
  const fontSize = Math.round(size * 0.4);
  const borderRadius = size / 2;

  return (
    <View
      style={[styles.base, { width: size, height: size, borderRadius, backgroundColor: bgColor }, style]}
      accessibilityLabel={name}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius }} contentFit="cover" />
      ) : (
        <Text
          style={[styles.initials, { fontSize, lineHeight: size, color: fgColor }]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  initials: {
    fontFamily: fonts.display.semibold,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
