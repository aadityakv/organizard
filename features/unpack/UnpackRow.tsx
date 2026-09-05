// One item on the unpack checklist: a big check target, the photo or glyph, name and
// quantity. Ticked rows dim and strike through so the eye lands on what is still boxed.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, Thumb } from '@/components';
import { isUnpacked, type Item } from '@/data/types';
import { firstPhotoSource } from '@/lib/photos';
import { colors, fonts, palette, radius, shadow } from '@/theme';

import { copy } from '@/copy/unpack';

/** Checklist row; `onToggle` is absent for viewers, which makes the row display-only. */
export function UnpackRow({
  item,
  boxColor,
  session,
  onToggle,
}: {
  item: Item;
  boxColor: string;
  session: string | null;
  onToggle?: (on: boolean) => void;
}) {
  const done = isUnpacked(item);
  const src = firstPhotoSource(item, session);

  const inner = (
    <>
      <View style={[styles.check, done && styles.checkOn]}>
        {done ? <Icon name="check" size={18} color={colors.textOnBrand} strokeWidth={3} /> : null}
      </View>
      <Thumb color={boxColor} icon={item.icon ?? 'package'} size={44} uri={src?.uri} headers={src?.headers} />
      <View style={styles.main}>
        <Text style={[styles.name, done && styles.nameDone]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.meta}>{copy.qty(item.qty)}</Text>
      </View>
    </>
  );

  if (!onToggle) return <View style={[styles.row, done && styles.rowDone]}>{inner}</View>;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={item.name}
      onPress={() => onToggle(!done)}
      style={({ pressed }) => [styles.row, done && styles.rowDone, pressed && styles.pressed]}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    padding: 10,
    minHeight: 64,
    ...shadow.xs,
  },
  rowDone: { opacity: 0.72 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: palette.sand400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.success, borderColor: colors.success },
  main: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.body.bold, fontSize: 15.5, color: palette.ink900 },
  nameDone: { color: palette.ink500, textDecorationLine: 'line-through' },
  meta: { fontFamily: fonts.body.semibold, fontSize: 13, color: palette.ink500, marginTop: 2 },
});
