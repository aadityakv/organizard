// A single photo in the strip: framed thumbnail, a clear "Cover" label on the
// first one, and an obvious remove button. Falls back to a placeholder glyph if
// the image can't load (e.g. a not-yet-resolved server photo) so the tile never
// renders as floating badges over a blank box.
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components';
import { photoSource } from '@/lib/photos';
import { colors, fonts, palette, radius, shadow } from '@/theme';

/** One captured photo in the strip, with cover badge and remove button. */
export function PhotoThumb({
  photoRef,
  session,
  isCover,
  onRemove,
}: {
  photoRef: string;
  session: string | null;
  isCover: boolean;
  onRemove: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.thumbWrap}>
      {failed ? (
        <View style={[styles.thumbImg, styles.thumbFailed]}>
          <Icon name="image-off" size={22} color={palette.ink400} />
        </View>
      ) : (
        <Image
          source={photoSource(photoRef, session)}
          style={styles.thumbImg}
          onError={() => setFailed(true)}
        />
      )}
      {isCover ? (
        <View style={styles.coverBadge}>
          <Text style={styles.coverBadgeText}>Cover</Text>
        </View>
      ) : null}
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel="Remove photo"
        hitSlop={10}
        style={({ pressed }) => [styles.thumbRemove, pressed && styles.thumbRemovePressed]}
      >
        <Icon name="x" size={16} color={palette.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  thumbWrap: {
    position: 'relative',
    paddingTop: 8,
    paddingRight: 8,
  },
  thumbImg: {
    width: 76,
    height: 76,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.sand300,
    backgroundColor: palette.cream100,
  },
  thumbFailed: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cream200,
  },
  coverBadge: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(20,22,21,0.62)',
  },
  coverBadgeText: {
    fontFamily: fonts.body.extra,
    fontSize: 9.5,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: palette.white,
  },
  thumbRemove: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  thumbRemovePressed: {
    opacity: 0.8,
    transform: [{ scale: 0.9 }],
  },
});
