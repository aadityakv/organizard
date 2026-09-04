// Photo gallery — collapsible strip/grid of the box cover + every item photo.
// Collapsed: a peek of the first few thumbs with a "+K" overlay on the last.
// Expanded: every thumb in a wrapping grid. Tapping any opens the full viewer.
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components';
import { photoSource } from '@/lib/photos';
import { type BoxPhoto, useStore } from '@/store/useStore';
import { fonts, palette, radius, alpha } from '@/theme';

import { shared } from './styles';

const GALLERY_PEEK = 4;

/** Collapsible strip of the box's photos (cover first, then item photos). */
export function PhotoGallery({
  photos,
  expanded,
  onToggle,
  onOpen,
}: {
  photos: BoxPhoto[];
  expanded: boolean;
  onToggle: () => void;
  onOpen: (index: number) => void;
}) {
  const session = useStore((s) => s.session);
  const extra = photos.length - GALLERY_PEEK;

  return (
    <View style={styles.gallerySection}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? 'Collapse photos' : 'Expand photos'}
        onPress={onToggle}
        style={({ pressed }) => [shared.sectionHead, pressed && shared.pressed]}
      >
        <Text style={shared.sectionTitle}>Photos · {photos.length}</Text>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={palette.ink500} />
      </Pressable>

      {expanded ? (
        <View style={styles.galleryGrid}>
          {photos.map((p, i) => {
            const src = photoSource(p.ref, session);
            return (
              <Pressable
                key={`${p.ref}-${i}`}
                accessibilityRole="imagebutton"
                accessibilityLabel={p.kind === 'box' ? 'Box photo' : `Photo from ${p.itemName ?? 'item'}`}
                onPress={() => onOpen(i)}
                style={({ pressed }) => [styles.galleryGridCell, pressed && shared.pressed]}
              >
                <Image source={src} style={styles.galleryThumb} resizeMode="cover" />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.galleryStrip}
        >
          {photos.slice(0, GALLERY_PEEK).map((p, i) => {
            const src = photoSource(p.ref, session);
            const isLast = i === GALLERY_PEEK - 1 && extra > 0;
            return (
              <Pressable
                key={`${p.ref}-${i}`}
                accessibilityRole="imagebutton"
                accessibilityLabel={
                  isLast
                    ? `View all ${photos.length} photos`
                    : p.kind === 'box'
                      ? 'Box photo'
                      : `Photo from ${p.itemName ?? 'item'}`
                }
                onPress={() => (isLast ? onToggle() : onOpen(i))}
                style={({ pressed }) => [styles.galleryStripCell, pressed && shared.pressed]}
              >
                <Image source={src} style={styles.galleryThumb} resizeMode="cover" />
                {isLast ? (
                  <View style={styles.galleryMore}>
                    <Text style={styles.galleryMoreText}>+{extra}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gallerySection: { marginBottom: 18 },
  galleryStrip: { gap: 8, paddingVertical: 2 },
  galleryStripCell: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: palette.cream100,
  },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  galleryGridCell: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: palette.cream100,
  },
  galleryThumb: { width: '100%', height: '100%' },
  galleryMore: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(palette.ink900, 0.55),
  },
  galleryMoreText: { fontFamily: fonts.display.bold, fontSize: 18, color: palette.white },
});
