// Print labels — pick boxes, print a sheet of scannable QR labels.
// Modal route. Lists every box in the move with a checkbox (all selected by
// default), a select-all/none toggle, and a "Print N labels" action that hands
// a print-ready HTML sheet to expo-print → the native iOS print/share dialog.
// Read-only data, so every role can reach it.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Button, Icon } from '@/components';
import { boxColor, colors, fonts, fontSize, palette, radius, shadow, space } from '@/theme';
import type { LabelInput } from '@/lib/qr/labels';
import { printLabels } from '@/services/print';
import { useStore } from '@/store/useStore';
import type { Box } from '@/data/types';
import { countOf } from '@/lib/text';
import { copy } from '@/copy/labels';

/** Print labels: pick boxes and share a PDF sheet of their QR labels. */
export default function PrintLabels() {
  const boxes = useStore((s) => s.boxes);
  const rooms = useStore((s) => s.rooms);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(boxes.map((b) => b.id)));

  const roomName = (roomId: string): string | undefined => rooms.find((r) => r.id === roomId)?.name;

  const allOn = boxes.length > 0 && selected.size === boxes.length;
  const count = selected.size;

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (): void => {
    setSelected(allOn ? new Set() : new Set(boxes.map((b) => b.id)));
  };

  const close = (): void => router.back();

  const print = (): void => {
    if (count === 0) return;
    const labels: LabelInput[] = boxes
      .filter((b) => selected.has(b.id))
      .map((b) => ({
        boxId: b.id,
        number: b.number,
        name: b.name,
        room: roomName(b.roomId),
      }));
    void printLabels(labels);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          style={({ pressed }) => [styles.topBtn, pressed && styles.pressed]}
        >
          <Icon name="x" size={22} color={colors.textBody} />
        </Pressable>

        <Text style={styles.title} numberOfLines={1}>
          {copy.printLabelsTitle}
        </Text>

        {boxes.length > 0 ? (
          <Pressable
            onPress={toggleAll}
            accessibilityRole="button"
            accessibilityLabel={allOn ? 'Deselect all boxes' : 'Select all boxes'}
            hitSlop={8}
            style={({ pressed }) => [styles.selectAll, pressed && styles.pressed]}
          >
            <Text style={styles.selectAllText}>{allOn ? 'None' : 'All'}</Text>
          </Pressable>
        ) : (
          <View style={styles.topBtn} />
        )}
      </View>

      {boxes.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="printer" size={32} color={palette.ink400} />
          <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
          <Text style={styles.emptyBody}>{copy.emptyBody}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.blurb}>{copy.introBody}</Text>
          {boxes.map((b) => (
            <BoxRow
              key={b.id}
              box={b}
              room={roomName(b.roomId)}
              checked={selected.has(b.id)}
              onToggle={() => toggle(b.id)}
            />
          ))}
        </ScrollView>
      )}

      {boxes.length > 0 ? (
        <View style={styles.footer}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            iconLeft="printer"
            disabled={count === 0}
            onPress={print}
          >
            {count === 0 ? 'Select a box to print' : `Print ${countOf(count, 'label')}`}
          </Button>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function BoxRow({
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
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceApp,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: space[2],
    gap: space[2],
    borderBottomWidth: 1,
    borderBottomColor: palette.sand300,
  },
  topBtn: {
    width: 56,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.display.bold,
    fontSize: 18,
    color: palette.ink900,
  },
  selectAll: {
    width: 56,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  selectAllText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: palette.green700,
  },

  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: space[3],
    paddingBottom: space[4],
    gap: space[2],
  },
  blurb: {
    fontFamily: fonts.body.semibold,
    fontSize: 13.5,
    lineHeight: 19,
    color: palette.ink500,
    marginBottom: space[2],
  },
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

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 6,
  },
  emptyTitle: {
    fontFamily: fonts.display.bold,
    fontSize: 17,
    color: palette.ink900,
    marginTop: 12,
  },
  emptyBody: {
    fontFamily: fonts.body.semibold,
    fontSize: 14,
    color: palette.ink500,
    textAlign: 'center',
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: space[3],
    paddingBottom: space[2],
    borderTopWidth: 1,
    borderTopColor: palette.sand300,
    backgroundColor: colors.surfaceApp,
  },

  pressed: { opacity: 0.7 },
});
