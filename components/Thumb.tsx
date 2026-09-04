// Photo placeholder — a soft tinted tile + category glyph, or a real image.
// Photos ARE the content, so this stands in until one is captured.
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { boxColor, boxTint, radius as radii } from '@/theme';
import { Icon } from './Icon';

export type ThumbProps = {
  color?: string;
  icon?: string;
  size?: number;
  radius?: number;
  /** Real captured photo URI (overrides the tinted glyph). */
  uri?: string | null;
  /** Request headers (e.g. auth) for a remote photo source. */
  headers?: Record<string, string>;
};

/** Square thumbnail: a photo when a URI is given, else a tinted icon placeholder. */
export function Thumb({
  color = 'green',
  icon = 'image',
  size = 56,
  radius = radii.md,
  uri,
  headers,
}: ThumbProps) {
  if (uri) {
    return <Image source={{ uri, headers }} style={{ width: size, height: size, borderRadius: radius }} />;
  }
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: radius, backgroundColor: boxTint(color) },
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.42)} color={boxColor(color)} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
});
