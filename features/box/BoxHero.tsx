// Tinted hero header: title/room, the "more" menu, and the status + value strip.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Header, Icon, IconButton, RoomGlyph, StatusChip } from '@/components';
import type { Box, Room, Status } from '@/data/types';
import { money } from '@/lib/money';
import { boxColor, boxTint, fonts, palette, space, NEUTRAL_HUE } from '@/theme';

import { shared } from './styles';

/** Tinted header for the box: number, name, room, status and the more menu. */
export function BoxHero({
  box,
  room,
  status,
  value,
  canEdit,
  showMenu,
  onMenu,
  onChangeStatus,
}: {
  box: Box;
  room?: Room;
  status?: Status;
  value: number;
  canEdit: boolean;
  showMenu: boolean;
  onMenu: () => void;
  onChangeStatus: () => void;
}) {
  const hue = boxColor(box.color);
  const subtitle = room ? (room.dest ? `${room.name} · ${room.dest}` : room.name) : '';
  const chip = <StatusChip label={status?.label ?? '—'} color={status?.color ?? NEUTRAL_HUE} />;

  return (
    <View style={[styles.hero, { backgroundColor: boxTint(box.color) }]}>
      <Header
        title={box.name}
        subtitle={subtitle}
        onBack={() => router.back()}
        leading={room ? <RoomGlyph icon={room.icon} color={room.color} size={28} /> : undefined}
        trailing={
          showMenu ? (
            <IconButton
              icon="more-horizontal"
              variant="plain"
              size="sm"
              accessibilityLabel="More options"
              onPress={onMenu}
            />
          ) : undefined
        }
      />

      <View style={styles.heroStrip}>
        <View style={[styles.heroDot, { backgroundColor: hue }]} />
        {canEdit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change box status"
            onPress={onChangeStatus}
            style={({ pressed }) => [styles.statusTap, pressed && shared.pressed]}
          >
            {chip}
            <Icon name="chevron-down" size={16} color={palette.ink500} />
          </Pressable>
        ) : (
          chip
        )}
        <Text style={styles.heroValue}>{money(value)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.sand300,
  },
  heroStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: 18,
    paddingBottom: space[3],
  },
  heroDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  statusTap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroValue: {
    marginLeft: 'auto',
    fontFamily: fonts.display.bold,
    fontSize: 18,
    color: palette.green600,
  },
});
