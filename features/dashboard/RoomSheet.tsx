// Dual-mode room sheet. No `room` prop → CREATE; with `room` → EDIT (prefilled,
// "Save changes" CTA, plus a Delete control gated by role/cascade size).
// Gated to Owner/Editor by the caller.
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ColorDot, Icon, Input, Sheet } from '@/components';
import type { Room } from '@/data/types';
import { useSheetForm } from '@/hooks/useSheetForm';
import { PERM } from '@/lib/permissions';
import { currentRole, useStore } from '@/store/useStore';
import { BOX_COLORS, colors, fonts, fontSize, palette, radius, space, NEUTRAL_HUE } from '@/theme';

import { ROOM_ICONS } from './constants';
import { shared, sheetForm } from './styles';
import { plural } from '@/lib/text';
import { copy } from '@/copy/dashboard';

/** Sheet to create or edit a room, including the role-gated cascade delete. */
export function RoomSheet({
  visible,
  onClose,
  room,
}: {
  visible: boolean;
  onClose: () => void;
  room?: Room;
}) {
  const addRoom = useStore((s) => s.addRoom);
  const updateRoom = useStore((s) => s.updateRoom);
  const deleteRoom = useStore((s) => s.deleteRoom);
  const role = useStore(currentRole);
  const boxes = useStore((s) => s.boxes);
  const itemsByBox = useStore((s) => s.itemsByBox);

  const isEdit = !!room;
  const [{ name, dest, icon, color }, patch] = useSheetForm(visible, () => ({
    name: room?.name ?? '',
    dest: room?.dest ?? '',
    icon: room?.icon ?? 'box',
    color: room?.color ?? NEUTRAL_HUE,
  }));

  const canSave = name.trim().length > 0;

  const save = (): void => {
    if (!canSave) return;
    const patch = { name: name.trim(), dest: dest.trim() || null, icon, color };
    if (room) updateRoom(room.id, patch);
    else addRoom(patch);
    onClose();
  };

  const confirmDeleteRoom = (): void => {
    if (!room) return;
    const roomBoxes = boxes.filter((b) => b.roomId === room.id);
    const itemCount = roomBoxes.reduce((sum, b) => sum + (itemsByBox[b.id]?.length ?? 0), 0);

    // Empty room — a simple, low-stakes delete any editor may perform.
    if (roomBoxes.length === 0) {
      Alert.alert(`Delete “${room.name}”?`, "This removes the room. This can't be undone.", [
        { text: copy.keepButton, style: 'cancel' },
        {
          text: copy.deleteRoomButton,
          style: 'destructive',
          onPress: () => {
            deleteRoom(room.id);
            onClose();
          },
        },
      ]);
      return;
    }

    // Cascade — destroys boxes + items. Owner-only.
    if (!PERM.canDelete(role)) {
      Alert.alert(copy.cascadeDeleteForbiddenTitle, copy.cascadeDeleteForbiddenBody, [
        { text: copy.okButton },
      ]);
      return;
    }

    const boxWord = plural(roomBoxes.length, 'box');
    const itemWord = plural(itemCount, 'item');
    Alert.alert(
      `Delete “${room.name}” and everything in it?`,
      `This permanently removes the room, its ${roomBoxes.length} ${boxWord}, and ${itemCount} ${itemWord}. This can't be undone.`,
      [
        { text: copy.cancelButton, style: 'cancel' },
        {
          text: copy.deleteAllButton,
          style: 'destructive',
          onPress: () => {
            deleteRoom(room.id);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={isEdit ? 'Edit room' : 'New room'}>
      <Input
        label={copy.roomNameLabel}
        value={name}
        onChangeText={(name) => patch({ name })}
        placeholder={copy.roomNamePlaceholder}
        autoFocus
        maxLength={200}
      />
      <View style={styles.fieldGap} />
      <Input
        label={copy.destinationLabel}
        value={dest}
        onChangeText={(dest) => patch({ dest })}
        placeholder={copy.destinationPlaceholder}
        maxLength={4000}
      />

      <Text style={sheetForm.fieldLabel}>{copy.iconLabel}</Text>
      <View style={styles.iconRow}>
        {ROOM_ICONS.map((ic) => {
          const on = ic === icon;
          return (
            <Pressable
              key={ic}
              accessibilityRole="button"
              accessibilityLabel={`${ic} icon`}
              accessibilityState={{ selected: on }}
              onPress={() => patch({ icon: ic })}
              style={({ pressed }) => [
                styles.iconPick,
                on && styles.iconPickOn,
                pressed && shared.pressedSoft,
              ]}
            >
              <Icon name={ic} size={20} color={on ? palette.green700 : palette.ink500} />
            </Pressable>
          );
        })}
      </View>

      <Text style={sheetForm.fieldLabel}>{copy.colorLabel}</Text>
      <View style={sheetForm.colorRow}>
        {BOX_COLORS.map((hue) => (
          <ColorDot
            key={hue}
            color={hue}
            size={28}
            selected={hue === color}
            onPress={() => patch({ color: hue })}
          />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!canSave}
        onPress={save}
        style={({ pressed }) => [
          sheetForm.cta,
          !canSave && sheetForm.ctaDisabled,
          pressed && canSave && sheetForm.ctaPressed,
        ]}
      >
        <Icon name={isEdit ? 'check' : 'plus'} size={20} color={colors.textOnBrand} />
        <Text style={sheetForm.ctaText}>{isEdit ? 'Save changes' : 'Add room'}</Text>
      </Pressable>

      {isEdit && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete room"
          onPress={confirmDeleteRoom}
          style={({ pressed }) => [styles.deleteRow, pressed && shared.pressedSoft]}
        >
          <Icon name="trash-2" size={18} color={colors.danger} />
          <Text style={styles.deleteText}>{copy.deleteRoomButton}</Text>
        </Pressable>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fieldGap: { height: 14 },
  iconRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  iconPick: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.sand300,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPickOn: {
    borderColor: colors.brand,
    backgroundColor: palette.green50,
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    marginTop: space[2],
  },
  deleteText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.base,
    color: colors.danger,
  },
});
