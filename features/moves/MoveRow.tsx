// A single move row — name, route, target, meta + Local/Shared badge.
// Tapping switches into the move; ⋯ opens a per-move menu.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, IconButton } from '@/components';
import type { MoveSummary } from '@/store/library';
import { colors, fonts, palette, radius, shadow } from '@/theme';

export function MoveRow({
  move,
  onOpen,
  onMenu,
}: {
  move: MoveSummary;
  onOpen: () => void;
  onMenu: () => void;
}) {
  const route = move.from && move.to ? `${move.from} → ${move.to}` : move.from || move.to || '';
  const shared = move.mode === 'shared';

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${move.name}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.rowBody, pressed && styles.pressedSoft]}
      >
        <View style={styles.rowText}>
          <View style={styles.rowTitleLine}>
            <Text style={styles.rowName} numberOfLines={1}>
              {move.name}
            </Text>
            <Badge label={shared ? 'Shared' : 'Local'} tone={shared ? 'info' : 'neutral'} size="sm" />
          </View>
          {route ? (
            <Text style={styles.rowRoute} numberOfLines={1}>
              {route}
            </Text>
          ) : null}
          {move.target ? <Text style={styles.rowTarget}>Target · {move.target}</Text> : null}
          <Text style={styles.rowMeta}>
            {move.boxCount} {move.boxCount === 1 ? 'box' : 'boxes'} · {move.itemCount}{' '}
            {move.itemCount === 1 ? 'item' : 'items'}
          </Text>
        </View>
      </Pressable>
      <IconButton
        icon="ellipsis"
        variant="ghost"
        size="sm"
        accessibilityLabel={`More options for ${move.name}`}
        onPress={onMenu}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    paddingLeft: 16,
    paddingRight: 6,
    ...shadow.sm,
  },
  rowBody: { flex: 1, paddingVertical: 14 },
  rowText: { gap: 3, minWidth: 0 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { fontFamily: fonts.display.bold, fontSize: 18, color: palette.ink900, flexShrink: 1 },
  rowRoute: { fontFamily: fonts.body.bold, fontSize: 13.5, color: palette.ink700 },
  rowTarget: { fontFamily: fonts.body.semibold, fontSize: 12.5, color: palette.ink500 },
  rowMeta: { fontFamily: fonts.body.semibold, fontSize: 12.5, color: palette.ink400, marginTop: 1 },
  pressedSoft: { opacity: 0.7 },
});
