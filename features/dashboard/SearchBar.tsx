// The Find field shown when search is open, with quick suggestions while empty.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, Input } from '@/components';
import { colors, fonts, fontSize, palette, radius, space } from '@/theme';

import { SEARCH_SUGGESTIONS } from './constants';
import { shared } from './styles';

/** Dashboard search field with suggestion pills. */
export function SearchBar({ query, onChange }: { query: string; onChange: (q: string) => void }) {
  const isSearching = query.trim().length > 0;
  return (
    <View style={styles.searchBlock}>
      <View style={styles.searchField}>
        <Icon name="search" size={18} color={palette.ink400} />
        <Input
          value={query}
          onChangeText={onChange}
          placeholder="Find an item — “Where's my…?”"
          autoFocus
          style={styles.searchInput}
        />
        {query.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => onChange('')}
            hitSlop={8}
          >
            <Icon name="x" size={18} color={palette.ink400} />
          </Pressable>
        )}
      </View>
      {!isSearching && (
        <View style={styles.suggestRow}>
          {SEARCH_SUGGESTIONS.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="button"
              onPress={() => onChange(s)}
              style={({ pressed }) => [styles.suggestPill, pressed && shared.pressedSoft]}
            >
              <Text style={styles.suggestText}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBlock: { marginBottom: 4 },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginBottom: 10,
  },
  searchInput: { flex: 1 },
  suggestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  suggestPill: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.sand300,
    backgroundColor: colors.surfaceCard,
  },
  suggestText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: palette.ink700,
  },
});
