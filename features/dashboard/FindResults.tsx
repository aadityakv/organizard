// Find — searches items + boxes across the whole move, with a Room › Box crumb. Shared
// by the Find tab (with filters) and the dashboard's inline search (query only).
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import { Icon, RoomGlyph, Thumb } from '@/components';
import type { Box, Room } from '@/data/types';
import { firstPhotoSource } from '@/lib/photos';
import {
  allIndexedItems,
  boxStats,
  searchMove,
  useStore,
  type FindFilters,
  type FindItemHit,
} from '@/store/useStore';
import { boxColor, colors, fonts, palette, radius, shadow } from '@/theme';

import { openBox } from './openBox';
import { routes } from '@/lib/routes';
import { countOf } from '@/lib/text';
import { copy } from '@/copy/dashboard';

const NO_FILTERS: FindFilters = {};

/** Search results: matching items and boxes with breadcrumbs, narrowed by optional filters. */
export function FindResults({ query, filters = NO_FILTERS }: { query: string; filters?: FindFilters }) {
  const boxes = useStore((s) => s.boxes);
  const rooms = useStore((s) => s.rooms);
  const markers = useStore((s) => s.markers);
  const itemsByBox = useStore((s) => s.itemsByBox);
  // Derive off stable slices (allIndexedItems builds new objects, so it can't be a live selector).
  const indexed = useMemo(() => allIndexedItems({ boxes, rooms, itemsByBox }), [boxes, rooms, itemsByBox]);

  const { items, boxes: matchedBoxes } = useMemo(
    () => searchMove({ boxes, markers, rooms }, indexed, query, filters),
    [boxes, markers, rooms, indexed, query, filters],
  );
  const roomFor = (id: string): Room | undefined => rooms.find((r) => r.id === id);

  if (items.length === 0 && matchedBoxes.length === 0) {
    return (
      <View style={styles.empty}>
        <Icon name="search-x" size={32} color={palette.ink400} />
        <Text style={styles.emptyTitle}>{copy.noResults}</Text>
        <Text style={styles.emptyBody}>
          {query.trim() ? `No items or boxes match “${query.trim()}”.` : copy.noResultsFiltered}
        </Text>
      </View>
    );
  }

  return (
    <View>
      {items.length > 0 && (
        <View style={styles.findSection}>
          <Text style={styles.findHeading}>Items · {items.length}</Text>
          <View style={styles.findList}>
            {items.map((it) => (
              <ItemResultRow key={it.id} item={it} room={roomFor(it.roomId)} />
            ))}
          </View>
        </View>
      )}

      {matchedBoxes.length > 0 && (
        <View>
          <Text style={styles.findHeading}>Boxes · {matchedBoxes.length}</Text>
          <View style={styles.findList}>
            {matchedBoxes.map((b) => (
              <BoxResultRow key={b.id} box={b} room={roomFor(b.roomId)} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function Breadcrumb({ room, boxNumber }: { room?: Room; boxNumber: number }) {
  return (
    <View style={styles.crumb}>
      {room ? <RoomGlyph icon={room.icon} color={room.color} size={18} /> : null}
      {room ? (
        <Text style={styles.crumbText} numberOfLines={1}>
          {room.name}
        </Text>
      ) : null}
      <Icon name="chevron-right" size={13} color={palette.ink400} />
      <Icon name="box" size={13} color={palette.ink400} />
      <Text style={styles.crumbText}>Box #{boxNumber}</Text>
    </View>
  );
}

function ItemResultRow({ item, room }: { item: FindItemHit; room?: Room }) {
  const session = useStore((s) => s.session);
  const src = firstPhotoSource(item, session);
  // Explain a hit the name alone doesn't: show the note when that's where the word was.
  const showNote = item.matchedOn.includes('note') && !item.matchedOn.includes('name') && !!item.note;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name} in box ${item.boxNumber}`}
      onPress={() => router.push(routes.item(item.id))}
      style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
    >
      <Thumb
        color={item.boxColor}
        icon={item.icon ?? 'image'}
        size={48}
        uri={src?.uri}
        headers={src?.headers}
      />
      <View style={styles.resultBody}>
        <Text style={styles.resultName} numberOfLines={1}>
          {item.name}
        </Text>
        <Breadcrumb room={room} boxNumber={item.boxNumber} />
        {showNote ? (
          <Text style={styles.resultNote} numberOfLines={1}>
            {copy.noteMatchPrefix}
            {item.note}
          </Text>
        ) : null}
      </View>
      <Icon name="arrow-up-right" size={18} color={palette.ink400} />
    </Pressable>
  );
}

function BoxResultRow({ box, room }: { box: Box; room?: Room }) {
  const { count } = useStore(useShallow((s) => boxStats(s, box.id)));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open box ${box.number}, ${box.name}`}
      onPress={() => openBox(box.id)}
      style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
    >
      <View style={[styles.boxBadge, { backgroundColor: boxColor(box.color) }]}>
        <Text style={styles.boxBadgeText}>#{box.number}</Text>
      </View>
      <View style={styles.resultBody}>
        <Text style={styles.resultName} numberOfLines={1}>
          {box.name}
        </Text>
        <Text style={styles.resultMeta} numberOfLines={1}>
          {room ? `${room.name} · ` : ''}
          {countOf(count, 'item')}
        </Text>
      </View>
      <Icon name="arrow-up-right" size={18} color={palette.ink400} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  findSection: { marginBottom: 18 },
  findHeading: {
    fontFamily: fonts.body.extra,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: palette.ink400,
    marginBottom: 10,
    marginTop: 4,
  },
  findList: { gap: 8 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    padding: 10,
    minHeight: 44,
    ...shadow.xs,
  },
  resultRowPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  resultBody: { flex: 1, minWidth: 0 },
  resultName: {
    fontFamily: fonts.body.bold,
    fontSize: 15.5,
    color: palette.ink900,
  },
  resultMeta: {
    fontFamily: fonts.body.bold,
    fontSize: 12.5,
    color: palette.ink500,
    marginTop: 2,
  },
  resultNote: {
    fontFamily: fonts.body.semibold,
    fontSize: 12.5,
    color: palette.ink500,
    fontStyle: 'italic',
    marginTop: 3,
  },
  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  crumbText: {
    fontFamily: fonts.body.bold,
    fontSize: 12.5,
    color: palette.ink500,
    flexShrink: 1,
  },

  boxBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxBadgeText: {
    fontFamily: fonts.display.bold,
    fontSize: 14,
    color: colors.textOnBrand,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 4,
  },
  emptyTitle: {
    fontFamily: fonts.display.bold,
    fontSize: 17,
    color: palette.ink900,
    marginTop: 12,
  },
  emptyBody: {
    fontFamily: fonts.body.semibold,
    fontSize: 14,
    color: palette.ink500,
    textAlign: 'center',
  },
});
