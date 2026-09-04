// Move to box (edit mode): pick the box this item should live in. Hidden when
// there is nowhere else to move it.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Box } from '@/data/types';
import { boxColor, colors, fonts, fontSize, palette, radius } from '@/theme';

import { sharedStyles } from './styles';

/** Edit-mode picker to move the item to another box. */
export function MoveToBoxPicker({
  boxes,
  targetBoxId,
  onSelect,
}: {
  boxes: Box[];
  targetBoxId: string;
  onSelect: (id: string) => void;
}) {
  if (boxes.length <= 1) return null;
  return (
    <View style={sharedStyles.chipSection}>
      <Text style={sharedStyles.sectionHeading}>Move to box</Text>
      <View style={sharedStyles.chipWrap}>
        {boxes.map((b) => {
          const on = b.id === targetBoxId;
          return (
            <Pressable
              key={b.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onSelect(b.id)}
              style={({ pressed }) => [
                styles.boxChip,
                on && styles.boxChipOn,
                pressed && styles.boxChipPressed,
              ]}
            >
              <View style={[styles.boxChipBadge, { backgroundColor: boxColor(b.color) }]}>
                <Text style={styles.boxChipBadgeText}>#{b.number}</Text>
              </View>
              <Text style={[styles.boxChipText, on && styles.boxChipTextOn]} numberOfLines={1}>
                {b.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  boxChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 40,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.sand300,
    backgroundColor: palette.white,
  },
  boxChipOn: {
    borderColor: colors.brand,
    backgroundColor: palette.green50,
  },
  boxChipPressed: {
    opacity: 0.8,
  },
  boxChipBadge: {
    minWidth: 30,
    height: 28,
    paddingHorizontal: 7,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChipBadgeText: {
    fontFamily: fonts.body.extra,
    fontSize: 11,
    color: palette.white,
  },
  boxChipText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: colors.textBody,
    maxWidth: 140,
  },
  boxChipTextOn: {
    color: palette.green700,
  },
});
