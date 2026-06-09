// Dashboard (home) — totals, room/status/value grouping, color-coded box grid,
// and Find. Role-aware: Owner/Editor get create affordances; Viewers see a LockNote.
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import {
  AddressField,
  BoxCard,
  Button,
  ColorDot,
  DateField,
  formatTargetDate,
  Header,
  Icon,
  IconButton,
  Input,
  LockNote,
  RoomGlyph,
  Segmented,
  Sheet,
  Thumb,
  ValueStat,
} from '@/components';
import type { Box, IndexedItem, Move, Room } from '@/data/types';
import { PERM } from '@/lib/permissions';
import { money } from '@/lib/money';
import { photoSource } from '@/lib/photos';
import {
  allIndexedItems,
  boxStats,
  currentRole,
  markerById,
  moveProgress,
  moveTotals,
  roomById,
  statusById,
  useStore,
  type Store,
} from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import {
  BOX_COLORS,
  boxColor,
  colors,
  fonts,
  fontSize,
  palette,
  radius,
  shadow,
  space,
} from '@/theme';

type GroupView = 'room' | 'status' | 'value';

const GROUP_OPTIONS: { value: GroupView; label: string }[] = [
  { value: 'room', label: 'Room' },
  { value: 'status', label: 'Status' },
  { value: 'value', label: 'Value' },
];

// Status-order used when sorting boxes in the non-room views (in_transit first,
// then packing, sealed, unpacked, anything custom last) — matches the design.
const STATUS_ORDER: Record<string, number> = {
  transit: 0,
  packing: 1,
  sealed: 2,
  unpacked: 3,
};

const ROOM_ICONS = [
  'box',
  'cooking-pot',
  'bed',
  'bath',
  'sofa',
  'briefcase',
  'shirt',
  'baby',
  'tv',
  'flower-2',
  'car',
  'dumbbell',
];

// Quick search suggestions surfaced when the search field is empty.
const SEARCH_SUGGESTIONS = ['Cast iron skillet', 'Monitor', 'Fragile'];

function openBox(id: string): void {
  router.push(`/box/${id}`);
}

// ---------------------------------------------------------------------------
// Card factory — resolves a box's status + markers + room for <BoxCard>.
// ---------------------------------------------------------------------------
function DashboardBoxCard({ box }: { box: Box }) {
  const status = useStore((s) => statusById(s, box.status));
  const room = useStore((s) => roomById(s, box.roomId));
  const markerDefs = useStore(
    useShallow((s) => box.markers.map((id) => markerById(s, id)).filter((m): m is NonNullable<typeof m> => Boolean(m))),
  );
  const { count, value } = useStore(useShallow((s) => boxStats(s, box.id)));
  const session = useStore((s) => s.session);
  const coverSrc = box.cover ? photoSource(box.cover, session) : undefined;

  return (
    <BoxCard
      name={box.name}
      number={box.number}
      color={box.color}
      room={room?.name}
      itemCount={count}
      value={value}
      statusLabel={status?.label ?? '—'}
      statusColor={status?.color ?? 'slate'}
      markers={markerDefs.map((m) => ({ label: m.label, color: m.color, icon: m.icon }))}
      cover={coverSrc?.uri ?? null}
      coverHeaders={coverSrc?.headers}
      onPress={() => openBox(box.id)}
      style={styles.gridCard}
    />
  );
}

// ---------------------------------------------------------------------------
// Find — searches items + boxes across the whole move, with a Room › Box crumb.
// ---------------------------------------------------------------------------
function FindResults({ query }: { query: string }) {
  const boxes = useStore((s) => s.boxes);
  const rooms = useStore((s) => s.rooms);
  const markers = useStore((s) => s.markers);
  const itemsByBox = useStore((s) => s.itemsByBox);
  // Derive off stable slices (allIndexedItems builds new objects, so it can't be a live selector).
  const indexed = useMemo(() => allIndexedItems({ boxes, rooms, itemsByBox } as Store), [boxes, rooms, itemsByBox]);

  const q = query.trim().toLowerCase();

  const markerLabel = (id: string): string =>
    markers.find((m) => m.id === id)?.label.toLowerCase() ?? '';

  const items = indexed.filter(
    (it) =>
      it.name.toLowerCase().includes(q) ||
      (it.markers ?? []).some((mid) => markerLabel(mid).includes(q)),
  );
  const matchedBoxes = boxes.filter((b) => b.name.toLowerCase().includes(q));
  const roomFor = (id: string): Room | undefined => rooms.find((r) => r.id === id);

  if (items.length === 0 && matchedBoxes.length === 0) {
    return (
      <View style={styles.empty}>
        <Icon name="search-x" size={32} color={palette.ink400} />
        <Text style={styles.emptyTitle}>Nothing found</Text>
        <Text style={styles.emptyBody}>No items or boxes match “{query}”.</Text>
      </View>
    );
  }

  return (
    <View>
      {items.length > 0 && (
        <View style={styles.findSection}>
          <Text style={styles.findHeading}>Items · {items.length}</Text>
          <View style={styles.findList}>
            {items.map((it) => (
              <ItemResultRow key={it.id} item={it} room={roomFor(it.roomId)} />
            ))}
          </View>
        </View>
      )}

      {matchedBoxes.length > 0 && (
        <View>
          <Text style={styles.findHeading}>Boxes · {matchedBoxes.length}</Text>
          <View style={styles.findList}>
            {matchedBoxes.map((b) => (
              <BoxResultRow key={b.id} box={b} room={roomFor(b.roomId)} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function Breadcrumb({ room, boxNumber }: { room?: Room; boxNumber: number }) {
  return (
    <View style={styles.crumb}>
      {room ? <RoomGlyph icon={room.icon} color={room.color} size={18} /> : null}
      {room ? (
        <Text style={styles.crumbText} numberOfLines={1}>
          {room.name}
        </Text>
      ) : null}
      <Icon name="chevron-right" size={13} color={palette.ink400} />
      <Icon name="box" size={13} color={palette.ink400} />
      <Text style={styles.crumbText}>Box #{boxNumber}</Text>
    </View>
  );
}

function ItemResultRow({ item, room }: { item: IndexedItem; room?: Room }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name} in box ${item.boxNumber}`}
      onPress={() => openBox(item.boxId)}
      style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
    >
      <Thumb color={item.boxColor} icon={item.icon ?? 'image'} size={48} />
      <View style={styles.resultBody}>
        <Text style={styles.resultName} numberOfLines={1}>
          {item.name}
        </Text>
        <Breadcrumb room={room} boxNumber={item.boxNumber} />
      </View>
      <Icon name="arrow-up-right" size={18} color={palette.ink400} />
    </Pressable>
  );
}

function BoxResultRow({ box, room }: { box: Box; room?: Room }) {
  const { count } = useStore(useShallow((s) => boxStats(s, box.id)));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open box ${box.number}, ${box.name}`}
      onPress={() => openBox(box.id)}
      style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
    >
      <View style={[styles.boxBadge, { backgroundColor: boxColor(box.color) }]}>
        <Text style={styles.boxBadgeText}>#{box.number}</Text>
      </View>
      <View style={styles.resultBody}>
        <Text style={styles.resultName} numberOfLines={1}>
          {box.name}
        </Text>
        <Text style={styles.resultMeta} numberOfLines={1}>
          {room ? `${room.name} · ` : ''}
          {count} {count === 1 ? 'item' : 'items'}
        </Text>
      </View>
      <Icon name="arrow-up-right" size={18} color={palette.ink400} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Add box / Add room sheets — gated to Owner/Editor by the caller.
// ---------------------------------------------------------------------------
function AddBoxSheet({
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
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(BOX_COLORS[0]);
  const [roomId, setRoomId] = useState<string | null>(defaultRoomId ?? rooms[0]?.id ?? null);

  // Keep the picker in sync when the sheet reopens for a specific room.
  React.useEffect(() => {
    if (visible) {
      setName('');
      setColor(BOX_COLORS[0]);
      setRoomId(defaultRoomId ?? rooms[0]?.id ?? null);
    }
  }, [visible, defaultRoomId, rooms]);

  const canSave = name.trim().length > 0 && roomId !== null;

  const create = (): void => {
    if (!canSave || roomId === null) return;
    const id = addBox({ name: name.trim(), color, roomId });
    onClose();
    openBox(id);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="New box">
      <Input
        label="What's in it?"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Kitchen essentials"
        autoFocus
      />

      <Text style={styles.fieldLabel}>Color</Text>
      <View style={styles.colorRow}>
        {BOX_COLORS.map((hue) => (
          <ColorDot
            key={hue}
            color={hue}
            size={28}
            selected={hue === color}
            onPress={() => setColor(hue)}
          />
        ))}
      </View>

      <Text style={styles.fieldLabel}>Room</Text>
      {rooms.length === 0 ? (
        <View style={styles.noRoomsHint}>
          <Text style={styles.noRoomsText}>Boxes live inside a room. Add your first room to start packing.</Text>
          <Button variant="secondary" size="md" iconLeft="plus" onPress={onAddRoom}>
            New room
          </Button>
        </View>
      ) : (
        <View style={styles.pickRow}>
          {rooms.map((r) => {
            const on = r.id === roomId;
            return (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setRoomId(r.id)}
                style={({ pressed }) => [
                  styles.roomPick,
                  on && styles.roomPickOn,
                  pressed && styles.pressedSoft,
                ]}
              >
                <RoomGlyph icon={r.icon} color={r.color} size={22} />
                <Text style={[styles.roomPickText, on && styles.roomPickTextOn]} numberOfLines={1}>
                  {r.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {rooms.length > 0 && (
      <Pressable
        accessibilityRole="button"
        disabled={!canSave}
        onPress={create}
        style={({ pressed }) => [
          styles.cta,
          !canSave && styles.ctaDisabled,
          pressed && canSave && styles.ctaPressed,
        ]}
      >
        <Icon name="plus" size={20} color={colors.textOnBrand} />
        <Text style={styles.ctaText}>Add box</Text>
      </Pressable>
      )}
    </Sheet>
  );
}

// Dual-mode room sheet. No `room` prop → CREATE; with `room` → EDIT (prefilled,
// "Save changes" CTA, plus a Delete control gated by role/cascade size).
function RoomSheet({
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
  // Read for the cascade-delete copy + gating (counts boxes & items in this room).
  const boxes = useStore((s) => s.boxes);
  const itemsByBox = useStore((s) => s.itemsByBox);

  const isEdit = !!room;
  const [name, setName] = useState('');
  const [dest, setDest] = useState('');
  const [icon, setIcon] = useState<string>('box');
  const [color, setColor] = useState<string>('slate');

  React.useEffect(() => {
    if (!visible) return;
    setName(room?.name ?? '');
    setDest(room?.dest ?? '');
    setIcon(room?.icon ?? 'box');
    setColor(room?.color ?? 'slate');
  }, [visible, room]);

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
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete room',
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
      Alert.alert(
        'Only the owner can delete a room with boxes',
        'Ask the move owner, or move/empty its boxes first.',
        [{ text: 'OK' }],
      );
      return;
    }

    const boxWord = roomBoxes.length === 1 ? 'box' : 'boxes';
    const itemWord = itemCount === 1 ? 'item' : 'items';
    Alert.alert(
      `Delete “${room.name}” and everything in it?`,
      `This permanently removes the room, its ${roomBoxes.length} ${boxWord}, and ${itemCount} ${itemWord}. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
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
        label="Room name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Garage, Nursery, Office"
        autoFocus
      />
      <View style={styles.fieldGap} />
      <Input
        label="Destination (optional)"
        value={dest}
        onChangeText={setDest}
        placeholder="Where it lands — e.g. NYC bedroom"
      />

      <Text style={styles.fieldLabel}>Icon</Text>
      <View style={styles.iconRow}>
        {ROOM_ICONS.map((ic) => {
          const on = ic === icon;
          return (
            <Pressable
              key={ic}
              accessibilityRole="button"
              accessibilityLabel={`${ic} icon`}
              accessibilityState={{ selected: on }}
              onPress={() => setIcon(ic)}
              style={({ pressed }) => [
                styles.iconPick,
                on && styles.iconPickOn,
                pressed && styles.pressedSoft,
              ]}
            >
              <Icon name={ic} size={20} color={on ? palette.green700 : palette.ink500} />
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.fieldLabel}>Color</Text>
      <View style={styles.colorRow}>
        {BOX_COLORS.map((hue) => (
          <ColorDot
            key={hue}
            color={hue}
            size={28}
            selected={hue === color}
            onPress={() => setColor(hue)}
          />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!canSave}
        onPress={save}
        style={({ pressed }) => [
          styles.cta,
          !canSave && styles.ctaDisabled,
          pressed && canSave && styles.ctaPressed,
        ]}
      >
        <Icon name={isEdit ? 'check' : 'plus'} size={20} color={colors.textOnBrand} />
        <Text style={styles.ctaText}>{isEdit ? 'Save changes' : 'Add room'}</Text>
      </Pressable>

      {isEdit && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete room"
          onPress={confirmDeleteRoom}
          style={({ pressed }) => [styles.deleteRow, pressed && styles.pressedSoft]}
        >
          <Icon name="trash-2" size={18} color={colors.danger} />
          <Text style={styles.deleteText}>Delete room</Text>
        </Pressable>
      )}
    </Sheet>
  );
}

// Edit-move sheet — name / from / to / target date. Prefilled from the live
// `move`. The date string round-trips via formatTargetDate: parse move.target to
// a Date for the picker, write the formatted label (or '' to clear) back on save.
function EditMoveSheet({
  visible,
  onClose,
  move,
}: {
  visible: boolean;
  onClose: () => void;
  move: Move;
}) {
  const updateMove = useStore((s) => s.updateMove);

  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState<Date | null>(null);

  React.useEffect(() => {
    if (!visible) return;
    setName(move.name ?? '');
    setFrom(move.from ?? '');
    setTo(move.to ?? '');
    const d = move.target ? new Date(move.target) : null;
    setDate(d && !isNaN(d.getTime()) ? d : null);
  }, [visible, move]);

  const canSave = name.trim().length > 0;

  const save = (): void => {
    if (!canSave) return;
    updateMove({
      name: name.trim(),
      from: from.trim(),
      to: to.trim(),
      target: date ? formatTargetDate(date) : '',
    });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Edit move">
      <Input
        label="Move name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. NYC Move"
        autoFocus
      />
      <View style={styles.fieldGap} />
      <Text style={styles.fieldLabel}>From</Text>
      <AddressField value={from} onChangeText={setFrom} placeholder="Current address" />
      <View style={styles.fieldGap} />
      <Text style={styles.fieldLabel}>To</Text>
      <AddressField value={to} onChangeText={setTo} placeholder="New address" />
      <View style={styles.fieldGap} />
      <Text style={styles.fieldLabel}>Target date</Text>
      <DateField value={date} onChange={setDate} placeholder="Pick a move date" />

      <Pressable
        accessibilityRole="button"
        disabled={!canSave}
        onPress={save}
        style={({ pressed }) => [
          styles.cta,
          !canSave && styles.ctaDisabled,
          pressed && canSave && styles.ctaPressed,
        ]}
      >
        <Icon name="check" size={20} color={colors.textOnBrand} />
        <Text style={styles.ctaText}>Save changes</Text>
      </Pressable>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const role = useStore(currentRole);
  const move = useStore((s) => s.move);
  const rooms = useStore((s) => s.rooms);
  const boxes = useStore((s) => s.boxes);
  const progress = useStore(useShallow(moveProgress));
  const totals = useStore(useShallow(moveTotals));

  const [view, setView] = useState<GroupView>('room');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [addingBox, setAddingBox] = useState(false);
  const [addingRoom, setAddingRoom] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingMove, setEditingMove] = useState(false);
  const [addBoxRoomId, setAddBoxRoomId] = useState<string | null>(null);

  const canEdit = PERM.canEdit(role);
  const isSearching = query.trim().length > 0;
  const pct = progress.total > 0 ? Math.round((progress.sealed / progress.total) * 100) : 0;

  // Boxes sorted for the Status / Value views.
  const sortedBoxes = useMemo<Box[]>(() => {
    const next = [...boxes];
    if (view === 'value') {
      // Value is computed from items; sort by live value, descending.
      return next; // sort handled below with stats injected via render
    }
    next.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
    return next;
  }, [boxes, view]);

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
            onPress={() => router.navigate('/moves')}
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
              onPress={() => router.navigate('/(tabs)/members')}
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

      {/* Move progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {searching && (
          <View style={styles.searchBlock}>
            <View style={styles.searchField}>
              <Icon name="search" size={18} color={palette.ink400} />
              <Input
                value={query}
                onChangeText={setQuery}
                placeholder="Find an item — “Where's my…?”"
                autoFocus
                style={styles.searchInput}
              />
              {query.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setQuery('')}
                  hitSlop={8}
                >
                  <Icon name="x" size={18} color={palette.ink400} />
                </Pressable>
              )}
            </View>
            {!isSearching && (
              <View style={styles.suggestRow}>
                {SEARCH_SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    accessibilityRole="button"
                    onPress={() => setQuery(s)}
                    style={({ pressed }) => [styles.suggestPill, pressed && styles.pressedSoft]}
                  >
                    <Text style={styles.suggestText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {isSearching ? (
          <FindResults query={query} />
        ) : (
          <>
            {/* Totals */}
            <View style={styles.totalsCard}>
              <ValueStat value={money(totals.value)} label="Estimated value" tone="brand" />
              <View style={styles.totalsDivider} />
              <ValueStat value={totals.boxes} label="Boxes" />
              <ValueStat value={totals.items} label="Items" />
            </View>

            {/* Group control */}
            <View style={styles.controlRow}>
              <Segmented
                options={GROUP_OPTIONS}
                value={view}
                onChange={(v) => setView(v as GroupView)}
                size="sm"
              />
            </View>

            {/* Grouped body */}
            {view === 'room' ? (
              <View>
                {rooms.map((room) => {
                  const roomBoxes = boxes.filter((b) => b.roomId === room.id);
                  return (
                    <View key={room.id} style={styles.group}>
                      <Pressable
                        accessibilityRole={canEdit ? 'button' : undefined}
                        accessibilityLabel={canEdit ? `Edit ${room.name}` : undefined}
                        disabled={!canEdit}
                        onPress={canEdit ? () => setEditingRoom(room) : undefined}
                        style={({ pressed }) => [
                          styles.groupHeader,
                          pressed && canEdit && styles.pressedSoft,
                        ]}
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
                        <Text style={styles.groupCount}>
                          {roomBoxes.length} {roomBoxes.length === 1 ? 'box' : 'boxes'}
                        </Text>
                        {canEdit ? (
                          <View style={styles.groupEditIcon}>
                            <Icon name="pencil" size={15} color={palette.ink400} />
                          </View>
                        ) : null}
                      </Pressable>

                      {roomBoxes.length > 0 ? (
                        <View style={styles.grid}>
                          {roomBoxes.map((b) => (
                            <DashboardBoxCard key={b.id} box={b} />
                          ))}
                        </View>
                      ) : (
                        <Pressable
                          accessibilityRole={canEdit ? 'button' : undefined}
                          disabled={!canEdit}
                          onPress={canEdit ? () => openAddBox(room.id) : undefined}
                          style={({ pressed }) => [
                            styles.emptyRoom,
                            pressed && canEdit && styles.pressedSoft,
                          ]}
                        >
                          <Text style={styles.emptyRoomText}>
                            {canEdit
                              ? 'Empty room — add a box here'
                              : 'No boxes in this room yet'}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}

                {/* Create affordances — Owner/Editor only; Viewer gets a LockNote. */}
                {canEdit ? (
                  <View style={styles.addRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Add box"
                      onPress={() => openAddBox(null)}
                      style={({ pressed }) => [
                        styles.addBtn,
                        styles.addBtnGrow,
                        pressed && styles.pressedSoft,
                      ]}
                    >
                      <Icon name="plus" size={20} color={palette.green600} />
                      <Text style={styles.addBtnText}>Add box</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Add room"
                      onPress={() => setAddingRoom(true)}
                      style={({ pressed }) => [styles.addBtn, pressed && styles.pressedSoft]}
                    >
                      <Icon name="plus" size={20} color={palette.green600} />
                      <Text style={styles.addBtnText}>Add room</Text>
                    </Pressable>
                  </View>
                ) : (
                  <LockNote>Viewers can browse and scan — ask the owner to add boxes.</LockNote>
                )}
              </View>
            ) : view === 'status' ? (
              <View style={styles.grid}>
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

// Value view needs live per-box value, which lives in the store; resolve it
// here, then sort descending.
function ValueSortedGrid({ boxes }: { boxes: Box[] }) {
  const itemsByBox = useStore((s) => s.itemsByBox);
  const sorted = useMemo<Box[]>(() => {
    const valueOf = (b: Box): number =>
      (itemsByBox[b.id] ?? []).reduce((sum, it) => sum + (it.value || 0), 0);
    return [...boxes].sort((a, b) => valueOf(b) - valueOf(a));
  }, [boxes, itemsByBox]);

  return (
    <View style={styles.grid}>
      {sorted.map((b) => (
        <DashboardBoxCard key={b.id} box={b} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const GRID_GAP = 14;

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

  // ── Totals ──
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

  // ── Group control ──
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  // ── Room groups ──
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

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridCard: {
    width: `48%`,
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

  // ── Add affordances ──
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

  // ── Search ──
  searchBlock: { marginBottom: 4 },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginBottom: 10,
  },
  searchInput: { flex: 1 },
  suggestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  suggestPill: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.sand300,
    backgroundColor: colors.surfaceCard,
  },
  suggestText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: palette.ink700,
  },

  // ── Find results ──
  findSection: { marginBottom: 18 },
  findHeading: {
    fontFamily: fonts.body.extra,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: palette.ink400,
    marginBottom: 10,
    marginTop: 4,
  },
  findList: { gap: 8 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    padding: 10,
    minHeight: 44,
    ...shadow.xs,
  },
  resultRowPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  resultBody: { flex: 1, minWidth: 0 },
  resultName: {
    fontFamily: fonts.body.bold,
    fontSize: 15.5,
    color: palette.ink900,
  },
  resultMeta: {
    fontFamily: fonts.body.bold,
    fontSize: 12.5,
    color: palette.ink500,
    marginTop: 2,
  },
  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  crumbText: {
    fontFamily: fonts.body.bold,
    fontSize: 12.5,
    color: palette.ink500,
    flexShrink: 1,
  },

  boxBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxBadgeText: {
    fontFamily: fonts.display.bold,
    fontSize: 14,
    color: colors.textOnBrand,
  },

  // ── Find empty ──
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 4,
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

  // ── Sheet content ──
  fieldLabel: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: palette.ink700,
    marginTop: 16,
    marginBottom: 8,
  },
  fieldGap: { height: 14 },
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
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
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

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    marginTop: 24,
    ...shadow.brand,
  },
  ctaDisabled: {
    opacity: 0.45,
    backgroundColor: palette.sand400,
  },
  ctaPressed: {
    backgroundColor: colors.brandPressed,
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.md,
    color: colors.textOnBrand,
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

  pressedSoft: { opacity: 0.7 },
});
