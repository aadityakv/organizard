// Cover photo card: the box photo (or a camera placeholder) with an edit button.
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components';
import type { Box } from '@/data/types';
import { photoSource } from '@/lib/photos';
import { boxColor, boxTint, fonts, palette, radius } from '@/theme';

import { shared } from './styles';

export function CoverCard({
  box,
  session,
  canEdit,
  onEdit,
}: {
  box: Box;
  session: string | null;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const hue = boxColor(box.color);
  return (
    <View style={[styles.cover, { backgroundColor: boxTint(box.color) }]}>
      {box.cover ? (
        <Image source={photoSource(box.cover, session)} style={styles.coverImage} resizeMode="cover" />
      ) : (
        <Icon name="camera" size={34} color={hue} />
      )}
      {!box.cover && <Text style={styles.coverHint}>{canEdit ? 'Add a box photo' : 'No box photo'}</Text>}
      {canEdit && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={box.cover ? 'Change box photo' : 'Add box photo'}
          onPress={onEdit}
          style={({ pressed }) => [styles.coverButton, pressed && shared.pressed]}
        >
          <Icon name="camera" size={18} color={palette.ink700} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    height: 132,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  coverImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  coverHint: {
    position: 'absolute',
    bottom: 12,
    fontFamily: fonts.body.bold,
    fontSize: 13,
    color: palette.ink500,
  },
  coverButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
