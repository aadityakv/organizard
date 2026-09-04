// Edit box sheet — rename, recolor, and move the box to another room.
import { Text, View } from 'react-native';

import { Button, ColorDot, Input, RoomPicker, Sheet } from '@/components';
import type { Box, Room } from '@/data/types';
import { useSheetForm } from '@/hooks/useSheetForm';
import { BOX_COLORS } from '@/theme';

import { shared } from './styles';
import { copy } from '@/copy/box';

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
    <Sheet visible={visible} onClose={onClose} title={copy.editBoxTitle}>
      <Input
        label={copy.boxNameLabel}
        value={name}
        onChangeText={(name) => patch({ name })}
        autoFocus
        maxLength={200}
      />

      <Text style={shared.fieldLabel}>{copy.colorLabel}</Text>
      <View style={shared.palette}>
        {BOX_COLORS.map((c) => (
          <ColorDot key={c} color={c} size={28} selected={c === color} onPress={() => patch({ color: c })} />
        ))}
      </View>

      <Text style={shared.fieldLabel}>{copy.roomLabel}</Text>
      <RoomPicker rooms={rooms} selectedId={roomId} onSelect={(roomId) => patch({ roomId })} />

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
