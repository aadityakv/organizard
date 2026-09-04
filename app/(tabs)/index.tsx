// Dashboard (home) — totals, room/status/value grouping, color-coded box grid,
// and Find. Role-aware: Owner/Editor get create affordances; Viewers see a LockNote.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Header, Icon, IconButton, LockNote, Segmented, ValueStat } from '@/components';
import type { Room } from '@/data/types';
import {
  AddBoxSheet,
  dashboardStyles,
  DashboardBoxCard,
  FindResults,
  GROUP_OPTIONS,
  RoomGroup,
  RoomSheet,
  SearchBar,
  useDashboard,
  ValueSortedGrid,
  type GroupView,
} from '@/features/dashboard';
import { EditMoveSheet } from '@/features/moves';
import { money } from '@/lib/money';
import { colors, fonts, fontSize, palette, radius, shadow, space } from '@/theme';
import { GROUP_VIEW } from '@/features/dashboard/constants';
import { routes } from '@/lib/routes';
import { copy } from '@/copy/dashboard';

/** Boxes tab: the open move at a glance, grouped by room, status or value, with add/edit sheets. */
export default function Dashboard() {
  const [view, setView] = useState<GroupView>(GROUP_VIEW.room);
  const { move, rooms, boxes, progress, totals, canEdit, pct, sortedBoxes } = useDashboard(view);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [addingBox, setAddingBox] = useState(false);
  const [addingRoom, setAddingRoom] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingMove, setEditingMove] = useState(false);
  const [addBoxRoomId, setAddBoxRoomId] = useState<string | null>(null);

  const isSearching = query.trim().length > 0;

  const openAddBox = (roomId: string | null): void => {
    setAddBoxRoomId(roomId);
    setAddingBox(true);
  };

  const toggleSearch = (): void => {
    setSearching((prev) => {
      if (prev) setQuery('');
      return !prev;
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header
        leading={
          <IconButton
            icon="chevron-left"
            variant="plain"
            size="sm"
            accessibilityLabel="Switch move"
            // navigate() (not push) so moves⇄tabs never stacks duplicate navigators.
            onPress={() => router.navigate(routes.moves)}
          />
        }
        title={move.name}
        subtitle={
          move.target
            ? `${progress.sealed} of ${progress.total} sealed · 🗓 ${move.target}`
            : `${progress.sealed} of ${progress.total} boxes sealed`
        }
        trailing={
          <>
            {canEdit ? (
              <IconButton
                icon="pencil"
                variant="plain"
                size="sm"
                accessibilityLabel="Edit move details"
                onPress={() => setEditingMove(true)}
              />
            ) : null}
            <IconButton
              icon="user-plus"
              variant="plain"
              size="sm"
              accessibilityLabel="Share & members"
              onPress={() => router.push(routes.members)}
            />
            <IconButton
              icon="printer"
              variant="plain"
              size="sm"
              accessibilityLabel="Print box labels"
              onPress={() => router.push(routes.printLabels)}
            />
            <IconButton
              icon={searching ? 'x' : 'search'}
              variant="plain"
              size="sm"
              accessibilityLabel={searching ? 'Close search' : 'Find an item'}
              onPress={toggleSearch}
            />
          </>
        }
      />

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {searching && <SearchBar query={query} onChange={setQuery} />}

        {isSearching ? (
          <FindResults query={query} />
        ) : (
          <>
            <View style={styles.totalsCard}>
              <ValueStat value={money(totals.value)} label={copy.estimatedValueLabel} tone="brand" />
              <View style={styles.totalsDivider} />
              <ValueStat value={totals.boxes} label={copy.boxesStatLabel} />
              <ValueStat value={totals.items} label={copy.itemsStatLabel} />
            </View>

            <View style={styles.controlRow}>
              <Segmented
                options={GROUP_OPTIONS}
                value={view}
                onChange={(v) => setView(v as GroupView)}
                size="sm"
              />
            </View>

            {view === GROUP_VIEW.room ? (
              <View>
                {rooms.map((room) => (
                  <RoomGroup
                    key={room.id}
                    room={room}
                    boxes={boxes.filter((b) => b.roomId === room.id)}
                    canEdit={canEdit}
                    onEdit={() => setEditingRoom(room)}
                    onAddBox={() => openAddBox(room.id)}
                  />
                ))}

                {canEdit ? (
                  <View style={styles.addRow}>
                    {/* Boxes are added per-room (the "+ Add box" tile in each room).
                        The bottom row is just for adding a whole new room. */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Add room"
                      onPress={() => setAddingRoom(true)}
                      style={({ pressed }) => [
                        styles.addBtn,
                        styles.addBtnGrow,
                        pressed && dashboardStyles.pressedSoft,
                      ]}
                    >
                      <Icon name="plus" size={20} color={palette.green600} />
                      <Text style={styles.addBtnText}>{copy.addRoomButton}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <LockNote>{copy.viewerLockNote}</LockNote>
                )}
              </View>
            ) : view === GROUP_VIEW.status ? (
              <View style={dashboardStyles.grid}>
                {sortedBoxes.map((b) => (
                  <DashboardBoxCard key={b.id} box={b} />
                ))}
              </View>
            ) : (
              <ValueSortedGrid boxes={boxes} />
            )}
          </>
        )}
      </ScrollView>

      {canEdit && (
        <>
          <AddBoxSheet
            visible={addingBox}
            onClose={() => setAddingBox(false)}
            rooms={rooms}
            defaultRoomId={addBoxRoomId}
            onAddRoom={() => {
              setAddingBox(false);
              setAddingRoom(true);
            }}
          />
          <RoomSheet visible={addingRoom} onClose={() => setAddingRoom(false)} />
          <RoomSheet
            visible={!!editingRoom}
            room={editingRoom ?? undefined}
            onClose={() => setEditingRoom(null)}
          />
          <EditMoveSheet visible={editingMove} onClose={() => setEditingMove(false)} move={move} />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceApp,
    paddingTop: space[2],
  },

  progressTrack: {
    height: 6,
    marginHorizontal: 18,
    marginBottom: space[2],
    borderRadius: radius.pill,
    backgroundColor: palette.cream200,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: space[2],
    paddingBottom: 120,
  },
  totalsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[5],
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 16,
    ...shadow.sm,
  },
  totalsDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: palette.sand300,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  addRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: space[1],
  },
  addBtn: {
    height: 52,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: palette.sand400,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addBtnGrow: { flex: 1 },
  addBtnText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.base,
    color: palette.green700,
  },
});
