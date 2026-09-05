// Find tab — "Where's my…?" search across the whole move, narrowed by room and status
// chips, plus scan-to-find (the Scan verb folds in here). Items → item detail, boxes →
// box detail. Results render through the same <FindResults> as the dashboard search.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Header, IconButton, SearchField } from '@/components';
import { FindFilters, FindResults } from '@/features/dashboard';
import { searchSuggestions, useStore, type FindFilters as Filters } from '@/store/useStore';
import { fonts, palette, radius } from '@/theme';
import { routes } from '@/lib/routes';
import { copy } from '@/copy/dashboard';

/** Find tab: search every item and box in the move, filter by room or status, or scan a label. */
export default function Find() {
  const boxes = useStore((s) => s.boxes);
  const rooms = useStore((s) => s.rooms);
  const statuses = useStore((s) => s.statuses);
  const markers = useStore((s) => s.markers);
  const itemsByBox = useStore((s) => s.itemsByBox);
  const suggestions = useMemo(
    () => searchSuggestions({ boxes, itemsByBox, markers }),
    [boxes, itemsByBox, markers],
  );
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>({});
  const hasFilter = (filters.roomId ?? null) !== null || (filters.statusId ?? null) !== null;
  const idle = !query.trim() && !hasFilter;

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
      {boxes.length > 0 ? (
        <FindFilters rooms={rooms} statuses={statuses} value={filters} onChange={setFilters} />
      ) : null}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {idle ? (
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
        ) : (
          <FindResults query={query} filters={filters} />
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
});
