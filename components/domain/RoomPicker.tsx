// Room-picker chip row: tap to select which room a box lives in. Shared by the
// Add-box and Edit-box sheets so the control (and its look) can't drift.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RoomGlyph } from './RoomGlyph';
import type { Room } from '@/data/types';
import { colors, fonts, fontSize, palette, radius } from '@/theme';

export type RoomPickerProps = {
  rooms: Room[];
  selectedId: string;
  onSelect: (roomId: string) => void;
};

/** Wrapped chips of rooms, one selectable; the selected chip is highlighted. */
export function RoomPicker({ rooms, selectedId, onSelect }: RoomPickerProps) {
  return (
    <View style={styles.row}>
      {rooms.map((r) => {
        const on = r.id === selectedId;
        return (
          <Pressable
            key={r.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(r.id)}
            style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.chipPressed]}
          >
            <RoomGlyph icon={r.icon} color={r.color} size={22} />
            <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
              {r.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
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
  chipOn: {
    borderColor: colors.brand,
    backgroundColor: palette.green50,
  },
  chipPressed: { opacity: 0.7 },
  chipText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: palette.ink500,
  },
  chipTextOn: { color: palette.green700 },
});
