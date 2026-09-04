// The "Items" section: count badge, search toggle + sort control, then the list
// (or one of the two empty states). Filtering/sorting lives in useVisibleItems.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Badge, Icon, IconButton, Input, Segmented, Thumb } from '@/components';
import type { Item, Marker } from '@/data/types';
import { colors, fonts, palette, radius, shadow, space } from '@/theme';

import { ItemRow } from './ItemRow';
import { shared } from './styles';
import { SORT_OPTIONS, type SortMode, useVisibleItems } from './useVisibleItems';
import { routes } from '@/lib/routes';
import { copy } from '@/copy/box';

/** The box's item list with search, sort and empty states. */
export function ItemsSection({
  items,
  allMarkers,
  boxColor,
  canEdit,
}: {
  items: Item[];
  allMarkers: Marker[];
  boxColor: string;
  canEdit: boolean;
}) {
  const { sortMode, setSortMode, searching, toggleSearching, query, setQuery, visibleItems } =
    useVisibleItems(items, allMarkers);

  return (
    <>
      <View style={shared.sectionHead}>
        <View style={styles.itemsTitleRow}>
          <Text style={styles.itemsTitle}>{copy.itemsHeading}</Text>
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
            onPress={toggleSearching}
          />
        )}
      </View>

      {items.length > 0 && (
        <View style={styles.itemControls}>
          {searching && (
            <View style={styles.searchField}>
              <Icon name="search" size={18} color={palette.ink400} />
              <Input
                value={query}
                onChangeText={setQuery}
                placeholder={copy.searchPlaceholder}
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
          <Thumb color={boxColor} icon="package-open" size={64} radius={radius.pill} />
          <Text style={styles.emptyTitle}>{copy.emptyItemsTitle}</Text>
          <Text style={styles.emptyBody}>
            {canEdit ? 'No items yet — add your first one to start packing.' : 'Nothing packed in here yet.'}
          </Text>
        </View>
      ) : visibleItems.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="search-x" size={32} color={palette.ink400} />
          <Text style={styles.emptyTitle}>{copy.noSearchMatches}</Text>
          <Text style={styles.emptyBody}>Nothing in this box matches “{query.trim()}”.</Text>
        </View>
      ) : (
        <View style={styles.itemList}>
          {visibleItems.map((it) => (
            <ItemRow
              key={it.id}
              item={it}
              boxColor={boxColor}
              markers={allMarkers}
              onPress={() => router.push(routes.item(it.id))}
            />
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  itemsTitle: { fontFamily: fonts.display.bold, fontSize: 18, color: palette.ink900 },
  itemsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemControls: { gap: 10, marginBottom: 12 },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  searchInput: { flex: 1 },
  itemList: { gap: 8 },
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
});
