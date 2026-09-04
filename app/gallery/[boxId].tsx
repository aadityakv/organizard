// app/gallery/[boxId].tsx — full-screen swipeable photo viewer for a box.
// Shows the box cover + every item photo on a dark background. Swipe between
// pages (a paging ScrollView — no swiper dependency). Each page is labelled
// "Box photo" or a tappable "From: <item>" pill that links to the item detail.
import { useMemo, useRef, useState } from 'react';
import {
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { Icon } from '@/components';
import { photoSource } from '@/lib/photos';
import { boxPhotos, useStore } from '@/store/useStore';
import { fonts, fontSize, palette, radius, space, tap, alpha } from '@/theme';
import { routes } from '@/lib/routes';

/** Full-screen photo viewer for a box: the cover and every item photo, swipeable. */
export default function GalleryScreen() {
  const { boxId, start } = useLocalSearchParams<{ boxId: string; start?: string }>();
  const id = boxId ?? '';

  const session = useStore((s) => s.session);
  // Derive off stable slices — boxPhotos builds a fresh array, so it can't be a live selector.
  const boxes = useStore((s) => s.boxes);
  const itemsByBox = useStore((s) => s.itemsByBox);
  const photos = useMemo(
    () => boxPhotos({ boxes, itemsByBox } as Parameters<typeof boxPhotos>[0], id),
    [boxes, itemsByBox, id],
  );

  const { width } = useWindowDimensions();

  const startIndex = useMemo(() => {
    const n = Number(start);
    if (!Number.isFinite(n)) return 0;
    return Math.min(Math.max(0, Math.floor(n)), Math.max(0, photos.length - 1));
  }, [start, photos.length]);

  const [index, setIndex] = useState(startIndex);
  const scrollRef = useRef<ScrollView>(null);
  const didInit = useRef(false);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(Math.min(Math.max(0, next), Math.max(0, photos.length - 1)));
  };

  // Jump to the requested start page once the content has laid out. onContentSizeChange
  // fires after the pages have real width, so the offset lands correctly on both platforms.
  const onContentSizeChange = () => {
    if (didInit.current || startIndex === 0 || width <= 0) return;
    didInit.current = true;
    scrollRef.current?.scrollTo({ x: startIndex * width, y: 0, animated: false });
  };

  if (photos.length === 0) {
    return <SafeAreaView style={styles.screen} />;
  }

  const current = photos[Math.min(index, photos.length - 1)];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        onContentSizeChange={onContentSizeChange}
        // iOS honors the initial offset directly; Android lands via onContentSizeChange.
        contentOffset={{ x: startIndex * width, y: 0 }}
      >
        {photos.map((p, i) => {
          const src = photoSource(p.ref, session);
          return (
            // Tap the photo to close — a guaranteed exit (swiping still pages between
            // photos; only a clean tap dismisses). The X stays as the obvious control.
            <Pressable
              key={`${p.ref}-${i}`}
              accessibilityRole="button"
              accessibilityLabel="Close photo viewer"
              onPress={() => router.back()}
              style={[styles.page, { width }]}
            >
              <Image
                source={src}
                style={styles.image}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.topBar} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Icon name="x" size={22} color={palette.white} />
        </Pressable>
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {Math.min(index, photos.length - 1) + 1} / {photos.length}
          </Text>
        </View>
      </View>

      <View style={styles.bottomBar} pointerEvents="box-none">
        {current.kind === 'box' ? (
          <View style={styles.labelPill}>
            <Icon name="package" size={15} color={palette.white} />
            <Text style={styles.labelText}>Box photo</Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${current.itemName ?? 'item'}`}
            onPress={() => current.itemId && router.push(routes.item(current.itemId))}
            style={({ pressed }) => [styles.labelPill, styles.labelPillTap, pressed && styles.pressed]}
          >
            <Icon name="package-open" size={15} color={palette.white} />
            <Text style={styles.labelText} numberOfLines={1}>
              From: {current.itemName ?? 'item'}
            </Text>
            <Icon name="chevron-right" size={16} color={palette.white} />
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.black },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[5],
    paddingTop: space[2],
  },
  close: {
    width: tap.md,
    height: tap.md,
    borderRadius: radius.pill,
    backgroundColor: alpha(palette.black, 0.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.pill,
    backgroundColor: alpha(palette.black, 0.5),
  },
  counterText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: palette.white,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: space[5],
    paddingHorizontal: space[5],
  },
  labelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    maxWidth: '90%',
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.pill,
    backgroundColor: alpha(palette.black, 0.6),
  },
  labelPillTap: { backgroundColor: alpha(palette.green600, 0.85) },
  labelText: {
    flexShrink: 1,
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: palette.white,
  },

  pressed: { opacity: 0.7 },
});
