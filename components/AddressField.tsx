// Address input with platform-native autocomplete. On iOS it streams Apple Maps
// (MKLocalSearchCompleter) suggestions as you type via the local `address-autocomplete`
// native module; on Android (no native module) it degrades to a plain field. Both
// platforms get a "Use my location" button (expo-location reverse-geocode).
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';

import { Icon } from './Icon';
import { Input } from './Input';
import {
  hasNativeAddressAutocomplete,
  searchAddresses,
  type AddressSuggestion,
} from '@/modules/address-autocomplete';
import { colors, fonts, fontSize, palette, radius, shadow, space } from '@/theme';

export type AddressFieldProps = {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
};

/** Address input with Apple Maps autocomplete suggestions (plain input where the module is absent). */
export function AddressField({ label, value, onChangeText, placeholder }: AddressFieldProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // After we fill the field programmatically (pick / use-location), the resulting
  // onChangeText would re-trigger a search; skip that one pass so the list stays closed.
  const suppress = useRef(false);

  const runSearch = useCallback((text: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!hasNativeAddressAutocomplete || text.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounce.current = setTimeout(async () => {
      const res = await searchAddresses(text);
      setSuggestions(res);
      setOpen(res.length > 0);
    }, 250);
  }, []);

  const onChange = (text: string) => {
    onChangeText(text);
    if (suppress.current) {
      suppress.current = false;
      return;
    }
    runSearch(text);
  };

  const fill = (next: string) => {
    suppress.current = true;
    onChangeText(next);
    setSuggestions([]);
    setOpen(false);
  };

  const pick = (s: AddressSuggestion) => fill(s.subtitle ? `${s.title}, ${s.subtitle}` : s.title);

  const useMyLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [p] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (p) {
        const parts = [p.name ?? p.street, p.city, p.region].filter(Boolean) as string[];
        if (parts.length > 0) fill(parts.join(', '));
      }
    } catch {
      // ignore — the user can still type the address manually
    } finally {
      setLocating(false);
    }
  };

  return (
    <View>
      <Input label={label} value={value} onChangeText={onChange} placeholder={placeholder} />

      {open ? (
        <View style={styles.dropdown}>
          {suggestions.map((s, i) => (
            <Pressable
              key={`${s.title}-${i}`}
              accessibilityRole="button"
              onPress={() => pick(s)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Icon name="map-pin" size={15} color={palette.ink400} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {s.title}
                </Text>
                {s.subtitle ? (
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {s.subtitle}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Use my location"
        onPress={useMyLocation}
        style={({ pressed }) => [styles.locBtn, pressed && styles.rowPressed]}
      >
        {locating ? (
          <ActivityIndicator size="small" color={colors.brand} />
        ) : (
          <Icon name="locate-fixed" size={15} color={colors.brand} />
        )}
        <Text style={styles.locText}>Use my location</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    marginTop: space[1],
    borderRadius: radius.md,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: palette.sand300,
    overflow: 'hidden',
    ...shadow.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: 11,
    paddingHorizontal: 12,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.sand300,
  },
  rowPressed: { backgroundColor: palette.cream100 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: fonts.body.bold, fontSize: fontSize.sm, color: palette.ink900 },
  rowSub: { fontFamily: fonts.body.semibold, fontSize: 12.5, color: palette.ink500, marginTop: 1 },
  locBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: space[2],
    paddingVertical: 6,
  },
  locText: { fontFamily: fonts.body.bold, fontSize: fontSize.sm, color: colors.brand },
});
