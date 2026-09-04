// Add-box sheet — gated to Owner/Editor by the caller.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, ColorDot, Icon, Input, RoomPicker, Sheet } from '@/components';
import type { Room } from '@/data/types';
import { useSheetForm } from '@/hooks/useSheetForm';
import { useStore } from '@/store/useStore';
import { BOX_COLORS, colors, fonts, fontSize, palette, radius } from '@/theme';

import { openBox } from './openBox';
import { sheetForm } from './styles';
import { copy } from '@/copy/dashboard';

/** Sheet to create a box: name, color and room. */
export function AddBoxSheet({
  visible,
  onClose,
  rooms,
  defaultRoomId,
  onAddRoom,
}: {
  visible: boolean;
  onClose: () => void;
  rooms: Room[];
  defaultRoomId: string | null;
  onAddRoom: () => void;
}) {
  const addBox = useStore((s) => s.addBox);
  // Re-initialised on every open so the picker follows the room the user tapped "+" in.
  const [{ name, color, roomId }, patch] = useSheetForm(visible, () => ({
    name: '',
    color: BOX_COLORS[0] as string,
    roomId: (defaultRoomId ?? rooms[0]?.id ?? null) as string | null,
  }));

  const canSave = name.trim().length > 0 && roomId !== null;

  const create = (): void => {
    if (!canSave || roomId === null) return;
    const id = addBox({ name: name.trim(), color, roomId });
    onClose();
    openBox(id);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={copy.newBoxTitle}>
      <Input
        label={copy.boxNameLabel}
        value={name}
        onChangeText={(name) => patch({ name })}
        placeholder={copy.boxNamePlaceholder}
        autoFocus
        maxLength={200}
      />

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

      <Text style={sheetForm.fieldLabel}>{copy.roomLabel}</Text>
      {rooms.length === 0 ? (
        <View style={styles.noRoomsHint}>
          <Text style={styles.noRoomsText}>{copy.noRoomsHint}</Text>
          <Button variant="secondary" size="md" iconLeft="plus" onPress={onAddRoom}>
            {copy.newRoomButton}
          </Button>
        </View>
      ) : (
        <RoomPicker rooms={rooms} selectedId={roomId ?? ''} onSelect={(roomId) => patch({ roomId })} />
      )}

      {rooms.length > 0 && (
        <Pressable
          accessibilityRole="button"
          disabled={!canSave}
          onPress={create}
          style={({ pressed }) => [
            sheetForm.cta,
            !canSave && sheetForm.ctaDisabled,
            pressed && canSave && sheetForm.ctaPressed,
          ]}
        >
          <Icon name="plus" size={20} color={colors.textOnBrand} />
          <Text style={sheetForm.ctaText}>{copy.addBoxButton}</Text>
        </Pressable>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  noRoomsHint: {
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: palette.cream100,
    borderWidth: 1,
    borderColor: palette.sand300,
  },
  noRoomsText: {
    fontFamily: fonts.body.semibold,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: palette.ink500,
  },
});
