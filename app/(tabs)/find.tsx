// Find tab — "Where's my…?" search across the whole move, plus scan-to-find
// (the Scan verb folds in here). Items → item detail, boxes → box detail.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Header, Icon, IconButton, RoomGlyph, SearchField, Thumb } from '@/components';
import type { Room } from '@/data/types';
import { allIndexedItems, searchMove, searchSuggestions, useStore } from '@/store/useStore';
import { fonts, palette, radius } from '@/theme';
import { routes } from '@/lib/routes';
import { copy } from '@/copy/dashboard';

/** Find tab: search every item and box in the move, or scan a label to jump to a box. */
export default function Find() {
  const boxes = useStore((s) => s.boxes);
  const rooms = useStore((s) => s.rooms);
  const markers = useStore((s) => s.markers);
  const itemsByBox = useStore((s) => s.itemsByBox);
  const indexed = useMemo(
    () => allIndexedItems({ boxes, rooms, itemsByBox } as Parameters<typeof allIndexedItems>[0]),
    [boxes, rooms, itemsByBox],
  );
  const suggestions = useMemo(
    () => searchSuggestions({ boxes, itemsByBox, markers }),
    [boxes, itemsByBox, markers],
  );
  const [query, setQuery] = useState('');
  const roomFor = (id: string): Room | undefined => rooms.find((r) => r.id === id);
  const { items, boxes: matchedBoxes } = useMemo(
    () => searchMove({ boxes, markers }, indexed, query),
    [boxes, markers, indexed, query],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header
        title={copy.findHeading}
        subtitle={copy.searchPlaceholder}
        trailing={
          <IconButton
            icon="scan-line"
            variant="plain"
            size="sm"
            accessibilityLabel="Scan a box"
            onPress={() => router.push(routes.scan)}
          />
        }
      />
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={copy.searchLabel}
        autoFocus
        style={styles.searchField}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!query.trim() ? (
          suggestions.length > 0 && (
            <View style={styles.suggest}>
              <Text style={styles.suggestTitle}>{copy.suggestionsPrefix}</Text>
              <View style={styles.chips}>
                {suggestions.map((s) => (
                  <Pressable
                    accessibilityRole="button"
                    key={s}
                    onPress={() => setQuery(s)}
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )
        ) : items.length === 0 && matchedBoxes.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="search-x" size={32} color={palette.ink400} />
            <Text style={styles.emptyTitle}>{copy.noResults}</Text>
            <Text style={styles.emptyBody}>No items or boxes match “{query}”.</Text>
          </View>
        ) : (
          <>
            {items.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.heading}>Items · {items.length}</Text>
                {items.map((it) => (
                  <Pressable
                    accessibilityRole="button"
                    key={it.id}
                    onPress={() => router.push(routes.item(it.id))}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    <Thumb color={it.boxColor} icon={it.icon ?? 'image'} size={48} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {it.name}
                      </Text>
                      <View style={styles.crumb}>
                        {roomFor(it.roomId) ? (
                          <RoomGlyph
                            icon={roomFor(it.roomId)!.icon}
                            color={roomFor(it.roomId)!.color}
                            size={16}
                          />
                        ) : null}
                        {roomFor(it.roomId) ? (
                          <Text style={styles.crumbText} numberOfLines={1}>
                            {roomFor(it.roomId)!.name}
                          </Text>
                        ) : null}
                        <Icon name="chevron-right" size={12} color={palette.ink400} />
                        <Text style={styles.crumbText}>Box #{it.boxNumber}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={18} color={palette.ink400} />
                  </Pressable>
                ))}
              </View>
            ) : null}
            {matchedBoxes.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.heading}>Boxes · {matchedBoxes.length}</Text>
                {matchedBoxes.map((b) => (
                  <Pressable
                    accessibilityRole="button"
                    key={b.id}
                    onPress={() => router.push(routes.box(b.id))}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    <Thumb color={b.color} icon="package" size={48} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {b.name}
                      </Text>
                      <Text style={styles.rowSub}>Box #{b.number}</Text>
                    </View>
                    <Icon name="chevron-right" size={18} color={palette.ink400} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.cream100 },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 6,
    paddingHorizontal: 14,
    height: 50,
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: palette.sand300,
  },
  content: { padding: 16, paddingBottom: 60 },
  suggest: { marginTop: 8 },
  suggestTitle: {
    fontFamily: fonts.body.extra,
    fontSize: 12,
    color: palette.ink400,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: palette.white,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: palette.sand300,
  },
  chipText: { fontFamily: fonts.body.bold, fontSize: 13.5, color: palette.ink700 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  emptyTitle: { fontFamily: fonts.display.bold, fontSize: 18, color: palette.ink900 },
  emptyBody: { fontFamily: fonts.body.semibold, fontSize: 13.5, color: palette.ink500, textAlign: 'center' },
  section: { marginBottom: 18 },
  heading: {
    fontFamily: fonts.body.extra,
    fontSize: 12,
    color: palette.ink400,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    padding: 10,
    marginBottom: 8,
  },
  rowPressed: { backgroundColor: palette.cream200 },
  rowName: { fontFamily: fonts.body.extra, fontSize: 15, color: palette.ink900 },
  rowSub: { fontFamily: fonts.body.bold, fontSize: 12.5, color: palette.ink500, marginTop: 2 },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  crumbText: { fontFamily: fonts.body.bold, fontSize: 12, color: palette.ink500, flexShrink: 1 },
});
