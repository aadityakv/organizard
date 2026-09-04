// Lucide icon wrapper — 2px rounded strokes, matches the brand.
// Accepts the kebab-case names the design uses (e.g. "scan-line").
import React from 'react';
import { icons } from 'lucide-react-native';

import { colors } from '@/theme';

const toPascal = (name: string): string =>
  name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

export type IconProps = {
  /** Kebab-case Lucide name, e.g. "package", "scan-line", "chevron-left". */
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

/** Lucide icon by kebab-case name, falling back to a generic glyph for unknown names. */
export function Icon({ name, size = 22, color = colors.textBody, strokeWidth = 2 }: IconProps) {
  const map = icons as unknown as Record<
    string,
    React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
  >;
  const Cmp = map[toPascal(name)] ?? map.Box;
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} />;
}
