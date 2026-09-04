// The Find field shown when search is open, with suggestions from the user's own data while empty.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SearchField } from '@/components';
import { colors, fonts, fontSize, palette, radius } from '@/theme';

import { shared } from './styles';
import { copy } from '@/copy/dashboard';

/** Dashboard search field with suggestion pills. */
export function SearchBar({
  query,
  onChange,
  suggestions,
}: {
  query: string;
  onChange: (q: string) => void;
  suggestions: string[];
}) {
  const isSearching = query.trim().length > 0;
  return (
    <View style={styles.searchBlock}>
      <SearchField
        value={query}
        onChangeText={onChange}
        placeholder={copy.searchLabel}
        autoFocus
        style={styles.searchField}
      />
      {!isSearching && suggestions.length > 0 && (
        <View style={styles.suggestRow}>
          {suggestions.map((s) => (
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
    marginBottom: 10,
  },
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
