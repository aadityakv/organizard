// Item detail — read-only hub for a single item. Tapping an item row opens this
// instead of the edit form; editing is a secondary action (Owner/Editor only).
import { useMemo } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { Button, Header, Icon, IconButton, MarkerChip, Thumb } from '@/components';
import {
  boxColor,
  boxTint,
  colors,
  fonts,
  fontSize,
  palette,
  radius,
  shadow,
  type as typeTokens,
  alpha,
  pressed,
} from '@/theme';
import { money } from '@/lib/money';
import { photoSource } from '@/lib/photos';
import { PERM } from '@/lib/permissions';
import { boxPhotos, currentRole, findItem, markerById, roomById, useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import type { Marker } from '@/data/types';
import { routes } from '@/lib/routes';
import { copy } from '@/copy/item';

/** Item detail: photos, fields, markers and breadcrumb, with edit as a secondary action. */
export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = id ?? '';

  const role = useStore(currentRole);
  // findItem builds a fresh { item, box } object each call; a bare selector would
  // hand useSyncExternalStore a new reference every render → "Maximum update depth
  // exceeded" (React 19 infinite loop). useShallow stabilizes it: item/box are stable
  // store refs, so the one-level compare returns the cached object until they change.
  const found = useStore(useShallow((s) => findItem(s, itemId)));
  const session = useStore((s) => s.session);
  const room = useStore((s) => (found ? roomById(s, found.box.roomId) : undefined));
  const itemMarkers = useStore(
    useShallow((s) =>
      found ? ((found.item.markers ?? []).map((mid) => markerById(s, mid)).filter(Boolean) as Marker[]) : [],
    ),
  );
  const deleteItem = useStore((s) => s.deleteItem);

  // The box's full photo list, so tapping an item photo opens the viewer at the
  // right spot in the box-wide gallery. Derive off stable slices (fresh array).
  const allBoxes = useStore((s) => s.boxes);
  const itemsByBox = useStore((s) => s.itemsByBox);
  const galleryBoxId = found?.box.id ?? '';
  const galleryPhotos = useMemo(
    () => boxPhotos({ boxes: allBoxes, itemsByBox } as Parameters<typeof boxPhotos>[0], galleryBoxId),
    [allBoxes, itemsByBox, galleryBoxId],
  );

  const canEdit = found ? PERM.canEdit(role) : false;
  const canDelete = found ? PERM.canDelete(role) : false;
  if (!found) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <Header title={copy.itemNotFoundHeader} onBack={() => router.back()} />
        <View style={styles.missing}>
          <Thumb color="slate" icon="package-x" size={72} radius={radius.pill} />
          <Text style={styles.missingTitle}>{copy.missingItemTitle}</Text>
          <Text style={styles.missingBody}>{copy.missingItemBody}</Text>
          <Button variant="secondary" size="md" iconLeft="arrow-left" onPress={() => router.back()}>
            {copy.goBackButton}
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const { item, box } = found;
  const hue = boxColor(box.color);
  const subtitle = box.name;

  const goEdit = () => router.push({ pathname: routes.addItem, params: { boxId: box.id, itemId: item.id } });

  const confirmDelete = () => {
    Alert.alert(`Delete "${item.name}"?`, "This removes the item from the box. This can't be undone.", [
      { text: copy.keepButton, style: 'cancel' },
      {
        text: copy.deleteItemButton,
        style: 'destructive',
        onPress: () => {
          deleteItem(box.id, item.id);
          router.back();
        },
      },
    ]);
  };

  const onMore = () => {
    const options: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (canEdit) {
      options.push({ text: copy.editItemButton, onPress: goEdit });
    }
    if (canDelete) {
      options.push({ text: copy.deleteItemButton, style: 'destructive', onPress: confirmDelete });
    }
    options.push({ text: copy.cancelButton, style: 'cancel' });
    Alert.alert(item.name, undefined, options);
  };

  const photos = item.photos ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={[styles.hero, { backgroundColor: boxTint(box.color) }]}>
        <Header
          title={item.name}
          subtitle={subtitle}
          onBack={() => router.back()}
          leading={<Thumb color={box.color} icon={item.icon ?? 'package'} size={28} />}
          trailing={
            canEdit || canDelete ? (
              <IconButton
                icon="more-horizontal"
                variant="plain"
                size="sm"
                accessibilityLabel="More options"
                onPress={onMore}
              />
            ) : undefined
          }
        />

        <View style={styles.heroStrip}>
          <View style={[styles.heroDot, { backgroundColor: hue }]} />
          <Text style={styles.heroQty}>{item.qty > 1 ? `Qty ${item.qty}` : 'Qty 1'}</Text>
          <Text style={styles.heroValue}>{money(item.value * item.qty)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {photos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoStrip}
          >
            {photos.map((photo, i) => {
              const src = photoSource(photo, session);
              const start = Math.max(
                0,
                galleryPhotos.findIndex((p) => p.kind === 'item' && p.itemId === item.id && p.ref === photo),
              );
              return (
                <Pressable
                  key={`${photo}-${i}`}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`View photo ${i + 1} of ${photos.length}`}
                  onPress={() =>
                    router.push({ pathname: routes.gallery(box.id), params: { start: String(start) } })
                  }
                  style={({ pressed }) => [styles.photo, pressed && styles.pressed]}
                >
                  <Image
                    source={src}
                    style={styles.photoImage}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.photoEmpty}>
            <Thumb color={box.color} icon={item.icon ?? 'package'} size={96} radius={radius.lg} />
            <Text style={styles.photoEmptyText}>{copy.noPhotos}</Text>
          </View>
        )}

        <View style={styles.fieldCard}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{copy.priceLabel}</Text>
            <Text style={styles.fieldValue}>{money(item.value)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{copy.quantityLabel}</Text>
            <Text style={styles.fieldValue}>{item.qty}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{copy.totalLabel}</Text>
            <Text style={styles.fieldValueStrong}>{money(item.value * item.qty)}</Text>
          </View>
          {item.note ? (
            <>
              <View style={styles.divider} />
              <View style={styles.noteBlock}>
                <Text style={styles.fieldLabel}>{copy.notesLabel}</Text>
                <Text style={styles.noteText}>{item.note}</Text>
              </View>
            </>
          ) : null}
        </View>

        {itemMarkers.length > 0 ? (
          <View style={styles.markerSection}>
            <Text style={styles.sectionTitle}>{copy.markersLabel}</Text>
            <View style={styles.markerWrap}>
              {itemMarkers.map((m) => (
                <MarkerChip key={m.id} label={m.label} color={m.color} icon={m.icon} />
              ))}
            </View>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open Box #${box.number}, ${box.name}`}
          onPress={() => router.push(routes.box(box.id))}
          style={({ pressed }) => [styles.crumb, pressed && styles.pressed]}
        >
          <Icon name="package" size={18} color={hue} />
          <Text style={styles.crumbText} numberOfLines={1}>
            Box #{box.number} · {box.name}
            {room ? ` · ${room.name}` : ''}
          </Text>
          <Icon name="chevron-right" size={18} color={palette.ink400} />
        </Pressable>

        {canEdit ? (
          <View style={styles.bottom}>
            <Button variant="primary" size="lg" fullWidth iconLeft="pencil" onPress={goEdit}>
              {copy.editItemButton}
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceApp },

  hero: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.sand300,
  },
  heroStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  heroDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: alpha(palette.black, 0.08),
  },
  heroQty: { fontFamily: fonts.body.bold, fontSize: 14, color: palette.ink500 },
  heroValue: {
    marginLeft: 'auto',
    fontFamily: fonts.display.bold,
    fontSize: 18,
    color: palette.green600,
  },

  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },

  photoStrip: { gap: 10, paddingBottom: 4 },
  photo: {
    width: 220,
    height: 220,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: palette.cream100,
  },
  photoImage: { width: '100%', height: '100%' },
  photoEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 28,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    ...shadow.sm,
  },
  photoEmptyText: { fontFamily: fonts.body.semibold, fontSize: 13.5, color: palette.ink400 },

  fieldCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    marginTop: 16,
    ...shadow.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  fieldLabel: { fontFamily: fonts.body.bold, fontSize: 14, color: palette.ink500 },
  fieldValue: { fontFamily: fonts.body.bold, fontSize: 15, color: palette.ink900 },
  fieldValueStrong: { fontFamily: fonts.display.bold, fontSize: 16, color: palette.green600 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: palette.sand300 },
  noteBlock: { paddingVertical: 14, gap: 6 },
  noteText: {
    fontFamily: fonts.body.semibold,
    fontSize: 14.5,
    lineHeight: 20,
    color: palette.ink700,
  },

  markerSection: { marginTop: 18 },
  sectionTitle: {
    fontFamily: fonts.display.bold,
    fontSize: 16,
    color: palette.ink900,
    marginBottom: 8,
  },
  markerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    ...shadow.xs,
  },
  crumbText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.body.bold,
    fontSize: 14,
    color: palette.ink700,
  },

  bottom: { marginTop: 22 },

  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  missingTitle: {
    ...typeTokens.heading,
    color: palette.ink900,
    textAlign: 'center',
    marginTop: 8,
  },
  missingBody: {
    fontFamily: fonts.body.semibold,
    fontSize: fontSize.base,
    color: palette.ink500,
    textAlign: 'center',
    marginBottom: 8,
  },

  pressed,
});
