// One packed item in the box list: thumb, name, qty + first marker, value.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MarkerChip, Thumb } from '@/components';
import type { Item, Marker } from '@/data/types';
import { money } from '@/lib/money';
import { photoSource } from '@/lib/photos';
import { useStore } from '@/store/useStore';
import { colors, fonts, palette, radius, shadow } from '@/theme';

import { shared } from './styles';

/** One item in the box list: thumbnail, name, quantity, value and markers. */
export function ItemRow({
  item,
  boxColor: hueName,
  markers,
  onPress,
}: {
  item: Item;
  boxColor: string;
  markers: Marker[];
  onPress?: () => void;
}) {
  const session = useStore((s) => s.session);
  const first = item.photos && item.photos.length > 0 ? item.photos[0] : undefined;
  const src = first ? photoSource(first, session) : undefined;
  const itemMarkers = (item.markers ?? [])
    .map((mid) => markers.find((m) => m.id === mid))
    .filter(Boolean) as Marker[];

  const inner = (
    <>
      <Thumb color={hueName} icon={item.icon ?? 'package'} size={52} uri={src?.uri} headers={src?.headers} />
      <View style={styles.itemMain}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.itemMeta}>
          <Text style={styles.itemQty}>{item.qty > 1 ? `Qty ${item.qty}` : 'Qty 1'}</Text>
          {itemMarkers.slice(0, 1).map((m) => (
            <MarkerChip key={m.id} label={m.label} color={m.color} icon={m.icon} size="sm" />
          ))}
        </View>
      </View>
      <Text style={styles.itemValue}>{money(item.value)}</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.name}`}
        onPress={onPress}
        style={({ pressed }) => [styles.itemRow, pressed && shared.pressed]}
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={styles.itemRow}>{inner}</View>;
}

const styles = StyleSheet.create({
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    padding: 10,
    ...shadow.xs,
  },
  itemMain: { flex: 1, minWidth: 0 },
  itemName: { fontFamily: fonts.body.bold, fontSize: 15.5, color: palette.ink900 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  itemQty: { fontFamily: fonts.body.semibold, fontSize: 13, color: palette.ink500 },
  itemValue: { fontFamily: fonts.display.bold, fontSize: 15, color: palette.ink700 },
});
