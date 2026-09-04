// The shared search field: search icon + input + a clear button once text exists.
// One component so Find, the dashboard search and in-box item search stay identical.
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { palette, space } from '@/theme';

export type SearchFieldProps = {
  value: string;
  onChangeText: (q: string) => void;
  placeholder?: string;
  /** @default false */
  autoFocus?: boolean;
  /** Extra styling on the wrapping row (e.g. margins). */
  style?: object;
};

/** Search input row with icon and clear button; the clear press empties the query. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  autoFocus = false,
  style,
}: SearchFieldProps) {
  return (
    <View style={[styles.searchField, style]}>
      <Icon name="search" size={18} color={palette.ink400} />
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={styles.searchInput}
      />
      {value.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          hitSlop={8}
        >
          <Icon name="x" size={18} color={palette.ink400} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  searchInput: { flex: 1 },
});
