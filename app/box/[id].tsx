// Box detail — cover photo, QR label, status, markers, and the items packed inside.
// Role-aware: Owner/Editor get every create/edit/delete affordance; Viewers are
// read-only but can still scan, view the QR, and print the label.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Linking from 'expo-linking';
import QRCode from 'react-native-qrcode-svg';

import {
  Badge,
  Button,
  ColorDot,
  Header,
  Icon,
  IconButton,
  Input,
  LockNote,
  MarkerChip,
  RoomGlyph,
  Segmented,
  Sheet,
  StatusChip,
  StreamUpsell,
  Thumb,
} from '@/components';
import {
  BOX_COLORS,
  boxColor,
  boxTint,
  colors,
  fonts,
  fontSize,
  palette,
  radius,
  shadow,
  space,
  type as typeTokens,
} from '@/theme';
import { money } from '@/lib/money';
import { photoSource, persistCapture } from '@/lib/photos';
import { PERM } from '@/lib/permissions';
import { encodeBoxQR } from '@/lib/qr';
import { printLabels } from '@/lib/labels';
import {
  type BoxPhoto,
  boxById,
  boxPhotos,
  boxStats,
  currentRole,
  isProNow,
  markerById,
  roomById,
  selectBoxItems,
  statusById,
  useStore,
} from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import type { Box, Item, Marker, Room, Status } from '@/data/types';

// In-box item sort. "Added" keeps the stored insertion order (today's default);
// the others are display-only re-orderings derived with useMemo.
type SortMode = 'added' | 'recent' | 'az' | 'value';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'added', label: 'Added' },
  { value: 'recent', label: 'Recent' },
  { value: 'az', label: 'A–Z' },
  { value: 'value', label: 'Value' },
];

export default function BoxDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const boxId = id ?? '';

  const role = useStore(currentRole);
  const box = useStore((s) => boxById(s, boxId));
  const session = useStore((s) => s.session);
  const isPro = useStore(isProNow);
  const startProTrial = useStore((s) => s.startProTrial);
  const [streamUpsell, setStreamUpsell] = useState(false);

  // Store actions (grabbed individually so selectors stay stable).
  const setBoxStatus = useStore((s) => s.setBoxStatus);
  const setBoxCover = useStore((s) => s.setBoxCover);
  const addStatus = useStore((s) => s.addStatus);
  const toggleBoxMarker = useStore((s) => s.toggleBoxMarker);
  const addMarker = useStore((s) => s.addMarker);
  const deleteBox = useStore((s) => s.deleteBox);
  const updateBox = useStore((s) => s.updateBox);
  const rooms = useStore((s) => s.rooms);

  // Resolve recipe — turn the box's ids into display data.
  const status = useStore((s) => (box ? statusById(s, box.status) : undefined));
  const room = useStore((s) => (box ? roomById(s, box.roomId) : undefined));
  const allStatuses = useStore((s) => s.statuses);
  const allMarkers = useStore((s) => s.markers);
  const boxMarkerDefs = useStore(
    useShallow((s) =>
      box ? (box.markers.map((mid) => markerById(s, mid)).filter(Boolean) as Marker[]) : [],
    ),
  );
  const items = useStore((s) => selectBoxItems(s, boxId));
  const stats = useStore(useShallow((s) => (box ? boxStats(s, boxId) : { count: 0, value: 0 })));

  // Combined photo gallery (cover + item photos). Derive off stable slices —
  // boxPhotos builds a fresh array, so it can't be a live selector.
  const allBoxes = useStore((s) => s.boxes);
  const itemsByBox = useStore((s) => s.itemsByBox);
  const photos = useMemo<BoxPhoto[]>(
    () => boxPhotos({ boxes: allBoxes, itemsByBox } as Parameters<typeof boxPhotos>[0], boxId),
    [allBoxes, itemsByBox, boxId],
  );

  // Which sheet is open ('status' | 'markers' | 'cover' | 'edit' | null).
  const [sheet, setSheet] = useState<'status' | 'markers' | 'cover' | 'edit' | null>(null);
  // Photo gallery starts collapsed; tapping the header chevron expands it.
  const [photosExpanded, setPhotosExpanded] = useState(false);

  // In-box item controls — sort mode + a toggleable search field (scoped to THIS box).
  const [sortMode, setSortMode] = useState<SortMode>('added');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  // The list actually rendered: filter THIS box's items by name + marker label,
  // then sort. Display-only — never mutates the stored array.
  const visibleItems = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter(
          (it) =>
            it.name.toLowerCase().includes(q) ||
            (it.markers ?? []).some((mid) =>
              (allMarkers.find((m) => m.id === mid)?.label.toLowerCase() ?? '').includes(q),
            ),
        )
      : items;

    if (sortMode === 'added') return filtered;
    const next = [...filtered];
    if (sortMode === 'recent') return next.reverse();
    if (sortMode === 'az')
      return next.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    // 'value' — by the item's displayed value, high → low.
    return next.sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [items, query, sortMode, allMarkers]);

  const canEdit = box ? PERM.canEdit(role) : false;
  const canDelete = box ? PERM.canDelete(role) : false;

  // ── Box not found ─────────────────────────────────────────────────────────
  if (!box) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <Header title="Box not found" onBack={() => router.back()} />
        <View style={styles.missing}>
          <Thumb color="slate" icon="package-x" size={72} radius={radius.pill} />
          <Text style={styles.missingTitle}>We couldn&apos;t find that box</Text>
          <Text style={styles.missingBody}>It may have been deleted, or the link is out of date.</Text>
          <Button variant="secondary" size="md" iconLeft="arrow-left" onPress={() => router.back()}>
            Go back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const hue = boxColor(box.color);
  const subtitle = room ? (room.dest ? `${room.name} · ${room.dest}` : room.name) : '';

  const confirmDelete = () => {
    Alert.alert(
      `Delete "${box.name}"?`,
      'This removes the box and everything packed inside. This can’t be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete box',
          style: 'destructive',
          onPress: () => {
            deleteBox(box.id);
            router.back();
          },
        },
      ],
    );
  };

  const onMore = () => {
    const options: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (canEdit) {
      options.push({ text: 'Edit box', onPress: () => setSheet('edit') });
    }
    if (canDelete) {
      options.push({ text: 'Delete box', style: 'destructive', onPress: confirmDelete });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(box.name, undefined, options);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {/* Tinted hero header */}
      <View style={[styles.hero, { backgroundColor: boxTint(box.color) }]}>
        <Header
          title={box.name}
          subtitle={subtitle}
          onBack={() => router.back()}
          leading={room ? <RoomGlyph icon={room.icon} color={room.color} size={28} /> : undefined}
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

        {/* Status + value strip */}
        <View style={styles.heroStrip}>
          <View style={[styles.heroDot, { backgroundColor: hue }]} />
          {canEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change box status"
              onPress={() => setSheet('status')}
              style={({ pressed }) => [styles.statusTap, pressed && styles.pressed]}
            >
              <StatusChip label={status?.label ?? '—'} color={status?.color ?? 'slate'} />
              <Icon name="chevron-down" size={16} color={palette.ink500} />
            </Pressable>
          ) : (
            <StatusChip label={status?.label ?? '—'} color={status?.color ?? 'slate'} />
          )}
          <Text style={styles.heroValue}>{money(stats.value)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Cover photo */}
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
              onPress={() => setSheet('cover')}
              style={({ pressed }) => [styles.coverButton, pressed && styles.pressed]}
            >
              <Icon name="camera" size={18} color={palette.ink700} />
            </Pressable>
          )}
        </View>

        {/* QR label card */}
        <View style={styles.qrCard}>
          <View style={styles.qrFrame}>
            <QRCode
              value={encodeBoxQR(box.id)}
              size={104}
              color={palette.ink900}
              backgroundColor={palette.white}
            />
          </View>
          <View style={styles.qrBody}>
            <Text style={styles.qrEyebrow}>Box #{box.number} label</Text>
            <Button
              variant="secondary"
              size="sm"
              iconLeft="scan-line"
              onPress={() => router.push(`/qr/${box.id}`)}
            >
              Show full-screen
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconLeft="printer"
              style={styles.qrPrint}
              onPress={() =>
                void printLabels([{ boxId: box.id, number: box.number, name: box.name, room: room?.name }])
              }
            >
              Print label
            </Button>
          </View>
        </View>

        {/* Photo gallery — cover + all item photos, collapsed by default */}
        {photos.length > 0 && (
          <PhotoGallery
            photos={photos}
            expanded={photosExpanded}
            onToggle={() => setPhotosExpanded((v) => !v)}
            onOpen={(i) => router.push({ pathname: `/gallery/${box.id}`, params: { start: String(i) } })}
          />
        )}

        {/* Markers */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Markers</Text>
          {canEdit && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit markers"
              onPress={() => setSheet('markers')}
              style={({ pressed }) => [styles.editLink, pressed && styles.pressed]}
            >
              <Icon name="plus" size={16} color={palette.green600} />
              <Text style={styles.editLinkText}>Edit markers</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.markerWrap}>
          {boxMarkerDefs.length === 0 ? (
            <Text style={styles.markerEmpty}>
              {canEdit ? 'No markers yet — flag it "Fragile", "Open first"…' : 'No markers.'}
            </Text>
          ) : (
            boxMarkerDefs.map((m) => <MarkerChip key={m.id} label={m.label} color={m.color} icon={m.icon} />)
          )}
        </View>

        {/* Items */}
        <View style={styles.sectionHead}>
          <View style={styles.itemsTitleRow}>
            <Text style={styles.itemsTitle}>Items</Text>
            <Badge
              label={
                query.trim().length > 0 ? `${visibleItems.length} of ${items.length}` : String(items.length)
              }
              tone="neutral"
            />
          </View>
          {items.length > 0 && (
            <IconButton
              icon={searching ? 'x' : 'search'}
              variant="plain"
              size="sm"
              accessibilityLabel={searching ? 'Close item search' : 'Search items in this box'}
              onPress={() =>
                setSearching((prev) => {
                  if (prev) setQuery('');
                  return !prev;
                })
              }
            />
          )}
        </View>

        {/* Sort + search controls — only when there are items to act on. */}
        {items.length > 0 && (
          <View style={styles.itemControls}>
            {searching && (
              <View style={styles.searchField}>
                <Icon name="search" size={18} color={palette.ink400} />
                <Input
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search items in this box…"
                  autoFocus
                  style={styles.searchInput}
                />
                {query.length > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    onPress={() => setQuery('')}
                    hitSlop={8}
                  >
                    <Icon name="x" size={18} color={palette.ink400} />
                  </Pressable>
                )}
              </View>
            )}
            <Segmented
              options={SORT_OPTIONS}
              value={sortMode}
              onChange={(v) => setSortMode(v as SortMode)}
              size="sm"
            />
          </View>
        )}

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Thumb color={box.color} icon="package-open" size={64} radius={radius.pill} />
            <Text style={styles.emptyTitle}>No items yet</Text>
            <Text style={styles.emptyBody}>
              {canEdit
                ? 'No items yet — add your first one to start packing.'
                : 'Nothing packed in here yet.'}
            </Text>
          </View>
        ) : visibleItems.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="search-x" size={32} color={palette.ink400} />
            <Text style={styles.emptyTitle}>No items match</Text>
            <Text style={styles.emptyBody}>Nothing in this box matches “{query.trim()}”.</Text>
          </View>
        ) : (
          <View style={styles.itemList}>
            {visibleItems.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                boxColor={box.color}
                markers={allMarkers}
                onPress={() => router.push(`/item/${it.id}`)}
              />
            ))}
          </View>
        )}

        {/* Bottom action */}
        <View style={styles.bottom}>
          {canEdit ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  iconLeft="plus"
                  onPress={() => router.push({ pathname: '/add-item', params: { boxId: box.id } })}
                >
                  Add item
                </Button>
              </View>
              <View style={{ flex: 1.25 }}>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  iconLeft="audio-lines"
                  onPress={() => (isPro ? router.push(`/stream/${box.id}`) : setStreamUpsell(true))}
                >
                  Stream items
                </Button>
                {!isPro ? (
                  <View style={styles.proBadge}>
                    <Text style={styles.proBadgeText}>PRO</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <LockNote>You&apos;re viewing as a guest. Ask the owner to invite you to add items.</LockNote>
          )}
        </View>
      </ScrollView>

      {/* ── Streaming Pro upsell ── */}
      <StreamUpsell
        visible={streamUpsell}
        onClose={() => setStreamUpsell(false)}
        onTryPro={() => {
          setStreamUpsell(false);
          // Pro is account-tied — a guest must sign in before starting the trial.
          if (!session) {
            router.push('/sign-in');
            return;
          }
          startProTrial();
          router.push(`/stream/${box.id}`);
        }}
      />

      {/* ── Status sheet ── */}
      <StatusSheet
        visible={sheet === 'status'}
        statuses={allStatuses}
        currentId={box.status}
        onClose={() => setSheet(null)}
        onPick={(statusId) => {
          setBoxStatus(box.id, statusId);
          setSheet(null);
        }}
        onCreate={(label, color) => {
          const newId = addStatus({ label, color });
          setBoxStatus(box.id, newId);
          setSheet(null);
        }}
      />

      {/* ── Markers sheet ── */}
      <MarkersSheet
        visible={sheet === 'markers'}
        allMarkers={allMarkers}
        selected={box.markers}
        onClose={() => setSheet(null)}
        onToggle={(markerId) => toggleBoxMarker(box.id, markerId)}
        onCreate={(label, color, icon) => {
          const newId = addMarker({ label, color, icon });
          toggleBoxMarker(box.id, newId);
        }}
      />

      {/* ── Cover photo sheet ── */}
      <CoverSheet
        visible={sheet === 'cover'}
        hasCover={!!box.cover}
        onClose={() => setSheet(null)}
        onCapture={(uri) => {
          setBoxCover(box.id, uri);
          setSheet(null);
        }}
        onRemove={() => {
          setBoxCover(box.id, null);
          setSheet(null);
        }}
      />

      {/* ── Edit box sheet ── */}
      <EditBoxSheet
        visible={sheet === 'edit'}
        box={box}
        rooms={rooms}
        onClose={() => setSheet(null)}
        onSave={(patch) => {
          updateBox(box.id, patch);
          setSheet(null);
        }}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Item row
// ─────────────────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  boxColor: hueName,
  markers,
  onPress,
}: {
  item: Item;
  boxColor: string;
  markers: Marker[];
  onPress?: () => void;
}) {
  const session = useStore((s) => s.session);
  const first = item.photos && item.photos.length > 0 ? item.photos[0] : undefined;
  const src = first ? photoSource(first, session) : undefined;
  const itemMarkers = (item.markers ?? [])
    .map((mid) => markers.find((m) => m.id === mid))
    .filter(Boolean) as Marker[];

  const inner = (
    <>
      <Thumb color={hueName} icon={item.icon ?? 'package'} size={52} uri={src?.uri} headers={src?.headers} />
      <View style={styles.itemMain}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.itemMeta}>
          <Text style={styles.itemQty}>{item.qty > 1 ? `Qty ${item.qty}` : 'Qty 1'}</Text>
          {itemMarkers.slice(0, 1).map((m) => (
            <MarkerChip key={m.id} label={m.label} color={m.color} icon={m.icon} size="sm" />
          ))}
        </View>
      </View>
      <Text style={styles.itemValue}>{money(item.value)}</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.name}`}
        onPress={onPress}
        style={({ pressed }) => [styles.itemRow, pressed && styles.pressed]}
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={styles.itemRow}>{inner}</View>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Photo gallery — collapsible strip/grid of the box cover + every item photo.
// Collapsed: a peek of the first few thumbs with a "+K" overlay on the last.
// Expanded: every thumb in a wrapping grid. Tapping any opens the full viewer.
// ─────────────────────────────────────────────────────────────────────────────

const GALLERY_PEEK = 4;

function PhotoGallery({
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
        style={({ pressed }) => [styles.sectionHead, pressed && styles.pressed]}
      >
        <Text style={styles.sectionTitle}>Photos · {photos.length}</Text>
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
                style={({ pressed }) => [styles.galleryGridCell, pressed && styles.pressed]}
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
                style={({ pressed }) => [styles.galleryStripCell, pressed && styles.pressed]}
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

// ─────────────────────────────────────────────────────────────────────────────
// Status sheet — pick an existing status or create a new one.
// ─────────────────────────────────────────────────────────────────────────────

function StatusSheet({
  visible,
  statuses,
  currentId,
  onPick,
  onCreate,
  onClose,
}: {
  visible: boolean;
  statuses: Status[];
  currentId: string;
  onPick: (statusId: string) => void;
  onCreate: (label: string, color: string) => void;
  onClose: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('orchid');

  const close = () => {
    setCreating(false);
    setName('');
    setColor('orchid');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title={creating ? 'Create a status' : 'Box status'}>
      {!creating ? (
        <View>
          <View style={styles.optionList}>
            {statuses.map((s) => {
              const active = s.id === currentId;
              return (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => onPick(s.id)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    active && styles.optionRowActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <StatusChip label={s.label} color={s.color} />
                  {s.custom ? <Text style={styles.customTag}>Custom</Text> : null}
                  {active ? (
                    <View style={styles.optionCheck}>
                      <Icon name="check" size={20} color={palette.green600} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a new status"
            onPress={() => setCreating(true)}
            style={({ pressed }) => [styles.dashed, pressed && styles.pressed]}
          >
            <Icon name="plus" size={18} color={palette.green600} />
            <Text style={styles.dashedText}>New status&hellip;</Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <Input
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Storage unit, Sell, Trash"
            autoFocus
          />
          <Text style={styles.fieldLabel}>Color</Text>
          <View style={styles.palette}>
            {BOX_COLORS.map((c) => (
              <ColorDot key={c} color={c} size={30} selected={c === color} onPress={() => setColor(c)} />
            ))}
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Preview</Text>
            <StatusChip label={name.trim() || 'New status'} color={color} />
          </View>
          <View style={styles.sheetActions}>
            <View style={styles.flex1}>
              <Button variant="ghost" size="md" fullWidth onPress={() => setCreating(false)}>
                Cancel
              </Button>
            </View>
            <View style={styles.flex1}>
              <Button
                variant="primary"
                size="md"
                fullWidth
                disabled={!name.trim()}
                onPress={() => {
                  onCreate(name.trim(), color);
                  setCreating(false);
                  setName('');
                  setColor('orchid');
                }}
              >
                Add status
              </Button>
            </View>
          </View>
        </View>
      )}
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Markers sheet — toggle the standard set, or create a new marker.
// ─────────────────────────────────────────────────────────────────────────────

function MarkersSheet({
  visible,
  allMarkers,
  selected,
  onToggle,
  onCreate,
  onClose,
}: {
  visible: boolean;
  allMarkers: Marker[];
  selected: string[];
  onToggle: (markerId: string) => void;
  onCreate: (label: string, color: string, icon: string) => void;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('coral');

  const close = () => {
    setAdding(false);
    setName('');
    setColor('coral');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title="Markers">
      <Text style={styles.sheetBlurb}>
        Handling flags for this box — fragile, open first, heavy&hellip; Tap to toggle.
      </Text>
      <View style={styles.markerSheetWrap}>
        {allMarkers.map((m) => (
          <MarkerChip
            key={m.id}
            label={m.label}
            color={m.color}
            icon={m.icon}
            selected={selected.includes(m.id)}
            onPress={() => onToggle(m.id)}
          />
        ))}
      </View>

      {adding ? (
        <View style={styles.markerCreate}>
          <Input
            label="New marker"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Do not stack, Sell, Donate"
            autoFocus
          />
          <Text style={styles.fieldLabel}>Color</Text>
          <View style={styles.palette}>
            {BOX_COLORS.map((c) => (
              <ColorDot key={c} color={c} size={30} selected={c === color} onPress={() => setColor(c)} />
            ))}
          </View>
          <View style={styles.sheetActions}>
            <View style={styles.flex1}>
              <Button variant="ghost" size="md" fullWidth onPress={() => setAdding(false)}>
                Cancel
              </Button>
            </View>
            <View style={styles.flex1}>
              <Button
                variant="primary"
                size="md"
                fullWidth
                disabled={!name.trim()}
                onPress={() => {
                  onCreate(name.trim(), color, 'tag');
                  setName('');
                  setColor('coral');
                  setAdding(false);
                }}
              >
                Create marker
              </Button>
            </View>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create a new marker"
          onPress={() => setAdding(true)}
          style={({ pressed }) => [styles.dashed, pressed && styles.pressed]}
        >
          <Icon name="plus" size={18} color={palette.green600} />
          <Text style={styles.dashedText}>Create a new marker</Text>
        </Pressable>
      )}

      <View style={styles.doneButton}>
        <Button variant="secondary" size="lg" fullWidth onPress={close}>
          Done
        </Button>
      </View>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cover sheet — snap a box photo (expo-camera) with a friendly permission fallback.
// ─────────────────────────────────────────────────────────────────────────────

function CoverSheet({
  visible,
  hasCover,
  onCapture,
  onRemove,
  onClose,
}: {
  visible: boolean;
  hasCover: boolean;
  onCapture: (uri: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);

  const capture = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const pic = await cameraRef.current?.takePictureAsync({ quality: 0.6 });
      if (pic?.uri) {
        const ref = await persistCapture(pic.uri);
        onCapture(ref);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Box photo">
      {!permission ? (
        <Text style={styles.sheetBlurb}>Getting the camera ready&hellip;</Text>
      ) : !permission.granted ? (
        <View>
          <Text style={styles.sheetBlurb}>
            {permission.canAskAgain
              ? 'Allow camera access to snap a quick photo of this box.'
              : 'Camera access is off. Turn it on in Settings to add a box photo.'}
          </Text>
          <View style={styles.doneButton}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              iconLeft="camera"
              onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
            >
              {permission.canAskAgain ? 'Allow camera' : 'Open settings'}
            </Button>
          </View>
        </View>
      ) : (
        <View>
          <View style={styles.cameraFrame}>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
          </View>
          <View style={styles.doneButton}>
            <Button variant="primary" size="lg" fullWidth iconLeft="camera" disabled={busy} onPress={capture}>
              {busy ? 'Saving…' : 'Take photo'}
            </Button>
          </View>
        </View>
      )}
      {hasCover ? (
        <View style={styles.removeCover}>
          <Button variant="ghost" size="md" fullWidth iconLeft="trash-2" onPress={onRemove}>
            Remove photo
          </Button>
        </View>
      ) : null}
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit box sheet — rename, recolor, and move the box to another room.
// ─────────────────────────────────────────────────────────────────────────────

function EditBoxSheet({
  visible,
  box,
  rooms,
  onSave,
  onClose,
}: {
  visible: boolean;
  box: Box;
  rooms: Room[];
  onSave: (patch: { name: string; color: string; roomId: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(box.name);
  const [color, setColor] = useState(box.color);
  const [roomId, setRoomId] = useState(box.roomId);

  // Reflect the box's current values whenever the sheet (re)opens.
  useEffect(() => {
    setName(box.name);
    setColor(box.color);
    setRoomId(box.roomId);
  }, [visible, box]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Edit box">
      <Input label="Box name" value={name} onChangeText={setName} autoFocus />

      <Text style={styles.fieldLabel}>Color</Text>
      <View style={styles.palette}>
        {BOX_COLORS.map((c) => (
          <ColorDot key={c} color={c} size={28} selected={c === color} onPress={() => setColor(c)} />
        ))}
      </View>

      <Text style={styles.fieldLabel}>Room</Text>
      <View style={styles.roomPickRow}>
        {rooms.map((r) => {
          const on = r.id === roomId;
          return (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setRoomId(r.id)}
              style={({ pressed }) => [styles.roomPick, on && styles.roomPickOn, pressed && styles.pressed]}
            >
              <RoomGlyph icon={r.icon} color={r.color} size={22} />
              <Text style={[styles.roomPickText, on && styles.roomPickTextOn]} numberOfLines={1}>
                {r.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.doneButton}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!name.trim()}
          onPress={() => onSave({ name: name.trim(), color, roomId })}
        >
          Save
        </Button>
      </View>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceApp },

  // Hero
  hero: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.sand300,
  },
  heroStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: 18,
    paddingBottom: space[3],
  },
  heroDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  statusTap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroValue: {
    marginLeft: 'auto',
    fontFamily: fonts.display.bold,
    fontSize: 18,
    color: palette.green600,
  },

  // Scroll body
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },

  // Cover
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

  // QR card
  qrCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 18,
    ...shadow.sm,
  },
  qrFrame: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: 6,
    borderWidth: 1,
    borderColor: palette.sand300,
  },
  qrBody: { flex: 1, justifyContent: 'center', gap: 8 },
  qrEyebrow: { fontFamily: fonts.body.extra, fontSize: 13, color: palette.ink500 },
  qrPrint: { alignSelf: 'flex-start' },

  // Photo gallery
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
    backgroundColor: 'rgba(42,39,34,0.55)',
  },
  galleryMoreText: { fontFamily: fonts.display.bold, fontSize: 18, color: palette.white },

  // Sections
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: { fontFamily: fonts.display.bold, fontSize: 16, color: palette.ink900 },
  itemsTitle: { fontFamily: fonts.display.bold, fontSize: 18, color: palette.ink900 },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  editLinkText: { fontFamily: fonts.body.bold, fontSize: 13.5, color: palette.green700 },

  // Markers
  markerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  markerEmpty: { fontFamily: fonts.body.semibold, fontSize: 13.5, color: palette.ink400 },

  // Items
  itemsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemControls: { gap: 10, marginBottom: 12 },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  searchInput: { flex: 1 },
  itemList: { gap: 8 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    padding: 10,
    ...shadow.xs,
  },
  itemMain: { flex: 1, minWidth: 0 },
  itemName: { fontFamily: fonts.body.bold, fontSize: 15.5, color: palette.ink900 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  itemQty: { fontFamily: fonts.body.semibold, fontSize: 13, color: palette.ink500 },
  itemValue: { fontFamily: fonts.display.bold, fontSize: 15, color: palette.ink700 },

  // Empty
  empty: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    ...shadow.sm,
  },
  emptyTitle: {
    fontFamily: fonts.display.bold,
    fontSize: 17,
    color: palette.ink900,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyBody: { fontFamily: fonts.body.semibold, fontSize: 14, color: palette.ink500, textAlign: 'center' },

  // Bottom
  bottom: { marginTop: 20 },
  proBadge: {
    position: 'absolute',
    top: -7,
    right: 8,
    backgroundColor: palette.amber400,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  proBadgeText: { fontSize: 10, fontFamily: fonts.body.extra, color: palette.ink900, letterSpacing: 0.3 },

  // Sheet — shared
  sheetBlurb: {
    fontFamily: fonts.body.semibold,
    fontSize: 13.5,
    color: palette.ink500,
    lineHeight: 19,
    marginBottom: 14,
  },
  fieldLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 13,
    color: palette.ink700,
    marginTop: 16,
    marginBottom: 8,
  },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roomPickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roomPick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.sand300,
    backgroundColor: colors.surfaceCard,
  },
  roomPickOn: {
    borderColor: colors.brand,
    backgroundColor: palette.green50,
  },
  roomPickText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: palette.ink500,
  },
  roomPickTextOn: { color: palette.green700 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  flex1: { flex: 1 },
  doneButton: { marginTop: 16 },

  // Status sheet
  optionList: { gap: 4, marginBottom: 12 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    minHeight: 44,
  },
  optionRowActive: { backgroundColor: palette.cream100 },
  optionCheck: { marginLeft: 'auto' },
  customTag: {
    fontFamily: fonts.body.extra,
    fontSize: 11,
    color: palette.ink400,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dashed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: palette.sand400,
    borderRadius: radius.md,
  },
  dashedText: { fontFamily: fonts.body.bold, fontSize: 15, color: palette.green700 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  previewLabel: { fontFamily: fonts.body.bold, fontSize: 13, color: palette.ink500 },

  // Markers sheet
  markerSheetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  markerCreate: {
    backgroundColor: palette.cream100,
    borderRadius: radius.lg,
    padding: 14,
  },

  // Cover sheet
  cameraFrame: {
    height: 240,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: palette.ink900,
  },
  removeCover: { marginTop: 8 },

  // Missing box
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

  pressed: { opacity: 0.7 },
});
