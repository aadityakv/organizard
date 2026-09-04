// One box in the print-labels list: checkbox, number badge, name and room.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components';
import type { Box } from '@/data/types';
import { boxColor, colors, fonts, palette, radius, shadow } from '@/theme';

/** Selectable row for a box on the print sheet. */
export function BoxRow({
  box,
  room,
  checked,
  onToggle,
}: {
  box: Box;
  room?: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`Box ${box.number}, ${box.name}`}
      onPress={onToggle}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.box, checked ? styles.boxOn : styles.boxOff]}>
        {checked ? <Icon name="check" size={16} color={palette.white} /> : null}
      </View>

      <View style={[styles.badge, { backgroundColor: boxColor(box.color) }]}>
        <Text style={styles.badgeText}>#{box.number}</Text>
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {box.name}
        </Text>
        {room ? (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {room}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    ...shadow.xs,
  },
  rowPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: {
    backgroundColor: colors.brand,
  },
  boxOff: {
    borderWidth: 2,
    borderColor: palette.sand400,
    backgroundColor: palette.white,
  },
  badge: {
    minWidth: 38,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fonts.display.bold,
    fontSize: 14,
    color: colors.textOnBrand,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: {
    fontFamily: fonts.body.bold,
    fontSize: 15.5,
    color: palette.ink900,
  },
  rowMeta: {
    fontFamily: fonts.body.bold,
    fontSize: 12.5,
    color: palette.ink500,
    marginTop: 2,
  },
});
