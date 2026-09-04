// One room on the dashboard: a tappable header (edit, for editors) and its box
// grid with an "Add box" tile, or an empty-room prompt.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, RoomGlyph } from '@/components';
import type { Box, Room } from '@/data/types';
import { fonts, fontSize, palette, radius } from '@/theme';

import { DashboardBoxCard } from './DashboardBoxCard';
import { shared } from './styles';
import { countOf } from '@/lib/text';

/** One room on the dashboard: header with edit action and its box grid or empty prompt. */
export function RoomGroup({
  room,
  boxes,
  canEdit,
  onEdit,
  onAddBox,
}: {
  room: Room;
  boxes: Box[];
  canEdit: boolean;
  onEdit: () => void;
  onAddBox: () => void;
}) {
  return (
    <View style={styles.group}>
      <Pressable
        accessibilityRole={canEdit ? 'button' : undefined}
        accessibilityLabel={canEdit ? `Edit ${room.name}` : undefined}
        disabled={!canEdit}
        onPress={canEdit ? onEdit : undefined}
        style={({ pressed }) => [styles.groupHeader, pressed && canEdit && shared.pressedSoft]}
      >
        <RoomGlyph icon={room.icon} color={room.color} size={28} />
        <Text style={styles.groupTitle} numberOfLines={1}>
          {room.name}
        </Text>
        {room.dest ? (
          <Text style={styles.groupDest} numberOfLines={1}>
            → {room.dest}
          </Text>
        ) : null}
        <Text style={styles.groupCount}>{countOf(boxes.length, 'box')}</Text>
        {canEdit ? (
          <View style={styles.groupEditIcon}>
            <Icon name="pencil" size={15} color={palette.ink400} />
          </View>
        ) : null}
      </Pressable>

      {boxes.length > 0 ? (
        <View style={shared.grid}>
          {boxes.map((b) => (
            <DashboardBoxCard key={b.id} box={b} />
          ))}
          {canEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add a box to ${room.name}`}
              onPress={onAddBox}
              style={({ pressed }) => [shared.gridCard, styles.addBoxTile, pressed && shared.pressedSoft]}
            >
              <Icon name="plus" size={22} color={palette.green600} />
              <Text style={styles.addBoxTileText}>Add box</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Pressable
          accessibilityRole={canEdit ? 'button' : undefined}
          disabled={!canEdit}
          onPress={canEdit ? onAddBox : undefined}
          style={({ pressed }) => [styles.emptyRoom, pressed && canEdit && shared.pressedSoft]}
        >
          <Text style={styles.emptyRoomText}>
            {canEdit ? 'Empty room — add a box here' : 'No boxes in this room yet'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 18 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  groupTitle: {
    fontFamily: fonts.display.bold,
    fontSize: 16,
    color: palette.ink900,
    flexShrink: 1,
  },
  groupDest: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.xs,
    color: palette.ink400,
    flexShrink: 1,
  },
  groupCount: {
    marginLeft: 'auto',
    fontFamily: fonts.body.bold,
    fontSize: 12.5,
    color: palette.ink400,
  },
  groupEditIcon: {
    marginLeft: 1,
  },

  addBoxTile: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.sand400,
    backgroundColor: palette.cream100,
  },
  addBoxTileText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: palette.green700,
  },

  emptyRoom: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.sand400,
    backgroundColor: palette.cream100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRoomText: {
    fontFamily: fonts.body.bold,
    fontSize: 13.5,
    color: palette.ink400,
    textAlign: 'center',
  },
});
