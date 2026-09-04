// The floating "last captured" card: tap to fix, or undo.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components';
import { money } from '@/lib/money';
import { boxColor, boxTint, colors, fonts, palette } from '@/theme';

import { sharedStyles } from './styles';
import type { SItem } from './types';

type Props = {
  item: SItem;
  colorOf: (boxId: string) => string;
  onEdit: () => void;
  onUndo: () => void;
};

/** Card for the most recent capture with edit and undo actions. */
export function LastCapturedCard({ item, colorOf, onEdit, onUndo }: Props) {
  return (
    <Pressable onPress={onEdit} style={styles.lastCard}>
      <View style={[sharedStyles.itemIcon, { backgroundColor: boxTint(colorOf(item.boxId)) }]}>
        <Icon name={item.icon} size={22} color={boxColor(colorOf(item.boxId))} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[styles.lastName, item.needsFix && { color: palette.amber600 }]}>
          {item.name}
        </Text>
        <View style={styles.chipRow}>
          {item.qty && item.qty > 1 ? <Text style={sharedStyles.qtyChip}>×{item.qty}</Text> : null}
          {item.value != null ? <Text style={sharedStyles.valChip}>{money(item.value)}</Text> : null}
          <Text style={styles.fixHint}>Tap to fix</Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <View style={styles.addedRow}>
          <Icon name="check" size={14} color={palette.green700} />
          <Text style={styles.addedText}>Added</Text>
        </View>
        <Pressable onPress={onUndo}>
          <Text style={styles.undo}>Undo</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lastCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 150,
    backgroundColor: colors.surfaceCard,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: palette.black,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  lastName: { fontFamily: fonts.body.extra, fontSize: 14.5, color: palette.ink900 },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: 4, alignItems: 'center' },
  fixHint: { color: palette.ink400, fontSize: 11.5, fontFamily: fonts.body.bold },
  addedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  addedText: { color: palette.green700, fontSize: 12, fontFamily: fonts.body.extra },
  undo: {
    color: palette.ink400,
    fontFamily: fonts.body.extra,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
