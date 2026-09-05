// Find's filter row: one row of room chips and one of status chips, each single-select
// (tap again to clear). Narrows the results to "things in this room" or "boxes in this
// state" so a query like "fragile" plus the In-transit chip answers "what breakable is
// still on the truck?".
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components';
import type { Room, Status } from '@/data/types';
import type { FindFilters as Filters } from '@/store/useStore';
import { boxColor, colors, fonts, fontSize, palette, radius } from '@/theme';
import { copy } from '@/copy/dashboard';

export type FindFiltersProps = {
  rooms: Room[];
  statuses: Status[];
  value: Filters;
  onChange: (next: Filters) => void;
};

/** Room and status chip rows for Find; hidden entirely when there is nothing to filter by. */
export function FindFilters({ rooms, statuses, value, onChange }: FindFiltersProps) {
  const roomId = value.roomId ?? null;
  const statusId = value.statusId ?? null;
  const showRooms = rooms.length > 1;
  const active = roomId !== null || statusId !== null;
  if (!showRooms && statuses.length === 0) return null;

  return (
    <View style={styles.block}>
      {showRooms ? (
        <ChipRow label={copy.filterRoomsLabel}>
          {rooms.map((r) => {
            const on = r.id === roomId;
            return (
              <Chip
                key={r.id}
                label={r.name}
                selected={on}
                hue={r.color}
                leading={<Icon name={r.icon} size={14} color={on ? colors.textOnBrand : boxColor(r.color)} />}
                onPress={() => onChange({ ...value, roomId: on ? null : r.id })}
              />
            );
          })}
        </ChipRow>
      ) : null}
      <ChipRow label={copy.filterStatusLabel}>
        {statuses.map((st) => {
          const on = st.id === statusId;
          return (
            <Chip
              key={st.id}
              label={st.label}
              selected={on}
              hue={st.color}
              leading={
                <View
                  style={[styles.dot, { backgroundColor: on ? colors.textOnBrand : boxColor(st.color) }]}
                />
              }
              onPress={() => onChange({ ...value, statusId: on ? null : st.id })}
            />
          );
        })}
        {active ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.clearFiltersLabel}
            onPress={() => onChange({ roomId: null, statusId: null })}
            hitSlop={6}
            style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          >
            <Icon name="x" size={14} color={palette.ink500} />
            <Text style={styles.clearText}>{copy.clearFiltersLabel}</Text>
          </Pressable>
        ) : null}
      </ChipRow>
    </View>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.row}
      accessibilityLabel={label}
    >
      {children}
    </ScrollView>
  );
}

function Chip({
  label,
  selected,
  hue,
  leading,
  onPress,
}: {
  label: string;
  selected: boolean;
  hue: string;
  leading: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: boxColor(hue), borderColor: boxColor(hue) },
        pressed && styles.pressed,
      ]}
    >
      {leading}
      <Text style={[styles.chipText, selected && styles.chipTextOn]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8, marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.sand300,
    backgroundColor: colors.surfaceCard,
  },
  chipText: { fontFamily: fonts.body.bold, fontSize: fontSize.sm, color: palette.ink700 },
  chipTextOn: { color: colors.textOnBrand },
  dot: { width: 8, height: 8, borderRadius: 4 },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, height: 34 },
  clearText: { fontFamily: fonts.body.bold, fontSize: fontSize.sm, color: palette.ink500 },
  pressed: { opacity: 0.7 },
});
