// Edit box sheet — rename, recolor, and move the box to another room.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, ColorDot, Input, RoomGlyph, Sheet } from '@/components';
import type { Box, Room } from '@/data/types';
import { useSheetForm } from '@/hooks/useSheetForm';
import { BOX_COLORS, colors, fonts, fontSize, palette, radius } from '@/theme';

import { shared } from './styles';

/** Sheet to rename a box, change its color or move it to another room. */
export function EditBoxSheet({
  visible,
  box,
  rooms,
  onSave,
  onClose,
}: {
  visible: boolean;
  box: Box;
  rooms: Room[];
  onSave: (patch: { name: string; color: string; roomId: string }) => void;
  onClose: () => void;
}) {
  const [{ name, color, roomId }, patch] = useSheetForm(visible, () => ({
    name: box.name,
    color: box.color,
    roomId: box.roomId,
  }));

  return (
    <Sheet visible={visible} onClose={onClose} title="Edit box">
      <Input label="Box name" value={name} onChangeText={(name) => patch({ name })} autoFocus />

      <Text style={shared.fieldLabel}>Color</Text>
      <View style={shared.palette}>
        {BOX_COLORS.map((c) => (
          <ColorDot key={c} color={c} size={28} selected={c === color} onPress={() => patch({ color: c })} />
        ))}
      </View>

      <Text style={shared.fieldLabel}>Room</Text>
      <View style={styles.roomPickRow}>
        {rooms.map((r) => {
          const on = r.id === roomId;
          return (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => patch({ roomId: r.id })}
              style={({ pressed }) => [styles.roomPick, on && styles.roomPickOn, pressed && shared.pressed]}
            >
              <RoomGlyph icon={r.icon} color={r.color} size={22} />
              <Text style={[styles.roomPickText, on && styles.roomPickTextOn]} numberOfLines={1}>
                {r.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={shared.doneButton}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!name.trim()}
          onPress={() => onSave({ name: name.trim(), color, roomId })}
        >
          Save
        </Button>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  roomPickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roomPick: {
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
  roomPickOn: {
    borderColor: colors.brand,
    backgroundColor: palette.green50,
  },
  roomPickText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: palette.ink500,
  },
  roomPickTextOn: { color: palette.green700 },
});
