// Box detail — cover photo, QR label, status, markers, and the items packed inside.
// Role-aware: Owner/Editor get every create/edit/delete affordance; Viewers are
// read-only but can still scan, view the QR, and print the label.
//
// This route composes the pieces in features/box; the data lives in useBoxDetail.
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { Button, Icon, LockNote, MarkerChip, StreamUpsell } from '@/components';
import {
  BoxHero,
  CoverCard,
  CoverSheet,
  EditBoxSheet,
  ItemsSection,
  MarkersSheet,
  MissingBox,
  PhotoGallery,
  QrLabelCard,
  StatusSheet,
  useBoxDetail,
} from '@/features/box';
import { shared } from '@/features/box/styles';
import { colors, fonts, palette } from '@/theme';
import { routes } from '@/lib/routes';

const SHEET = { status: 'status', markers: 'markers', cover: 'cover', edit: 'edit' } as const;
type SheetKind = (typeof SHEET)[keyof typeof SHEET];

/** Box detail: hero, cover, QR label, items with search/sort, and the status/markers/cover/edit sheets. */
export default function BoxDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const boxId = id ?? '';
  const d = useBoxDetail(boxId);
  const { box, room, session, isPro, canEdit, canDelete, actions } = d;

  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [streamUpsell, setStreamUpsell] = useState(false);
  const [photosExpanded, setPhotosExpanded] = useState(false);

  if (!box) return <MissingBox />;

  const closeSheet = () => setSheet(null);

  const confirmDelete = () => {
    Alert.alert(
      `Delete "${box.name}"?`,
      'This removes the box and everything packed inside. This can’t be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete box',
          style: 'destructive',
          onPress: () => {
            actions.deleteBox(box.id);
            router.back();
          },
        },
      ],
    );
  };

  const onMore = () => {
    const options: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (canEdit) options.push({ text: 'Edit box', onPress: () => setSheet(SHEET.edit) });
    if (canDelete) options.push({ text: 'Delete box', style: 'destructive', onPress: confirmDelete });
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(box.name, undefined, options);
  };

  const startStreaming = () => (isPro ? router.push(routes.stream(box.id)) : setStreamUpsell(true));

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <BoxHero
        box={box}
        room={room}
        status={d.status}
        value={d.stats.value}
        canEdit={canEdit}
        showMenu={canEdit || canDelete}
        onMenu={onMore}
        onChangeStatus={() => setSheet(SHEET.status)}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <CoverCard box={box} session={session} canEdit={canEdit} onEdit={() => setSheet(SHEET.cover)} />
        <QrLabelCard box={box} roomName={room?.name} />

        {d.photos.length > 0 && (
          <PhotoGallery
            photos={d.photos}
            expanded={photosExpanded}
            onToggle={() => setPhotosExpanded((v) => !v)}
            onOpen={(i) => router.push({ pathname: routes.gallery(box.id), params: { start: String(i) } })}
          />
        )}

        <View style={shared.sectionHead}>
          <Text style={shared.sectionTitle}>Markers</Text>
          {canEdit && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit markers"
              onPress={() => setSheet(SHEET.markers)}
              style={({ pressed }) => [styles.editLink, pressed && shared.pressed]}
            >
              <Icon name="plus" size={16} color={palette.green600} />
              <Text style={styles.editLinkText}>Edit markers</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.markerWrap}>
          {d.boxMarkerDefs.length === 0 ? (
            <Text style={styles.markerEmpty}>
              {canEdit ? 'No markers yet — flag it "Fragile", "Open first"…' : 'No markers.'}
            </Text>
          ) : (
            d.boxMarkerDefs.map((m) => (
              <MarkerChip key={m.id} label={m.label} color={m.color} icon={m.icon} />
            ))
          )}
        </View>

        <ItemsSection items={d.items} allMarkers={d.allMarkers} boxColor={box.color} canEdit={canEdit} />

        <View style={styles.bottom}>
          {canEdit ? (
            <View style={styles.actionRow}>
              <View style={styles.addItem}>
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  iconLeft="plus"
                  onPress={() => router.push({ pathname: routes.addItem, params: { boxId: box.id } })}
                >
                  Add item
                </Button>
              </View>
              <View style={styles.streamItems}>
                <Button variant="primary" size="lg" fullWidth iconLeft="audio-lines" onPress={startStreaming}>
                  Stream items
                </Button>
                {!isPro ? (
                  <View style={styles.proBadge}>
                    <Text style={styles.proBadgeText}>PRO</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <LockNote>You&apos;re viewing as a guest. Ask the owner to invite you to add items.</LockNote>
          )}
        </View>
      </ScrollView>

      <StreamUpsell
        visible={streamUpsell}
        onClose={() => setStreamUpsell(false)}
        onTryPro={() => {
          setStreamUpsell(false);
          // Pro is account-tied — a guest must sign in before starting the trial.
          if (!session) {
            router.push(routes.signIn);
            return;
          }
          actions.startProTrial();
          router.push(routes.stream(box.id));
        }}
      />

      <StatusSheet
        visible={sheet === SHEET.status}
        statuses={d.allStatuses}
        currentId={box.status}
        onClose={closeSheet}
        onPick={(statusId) => {
          actions.setBoxStatus(box.id, statusId);
          closeSheet();
        }}
        onCreate={(label, color) => {
          const newId = actions.addStatus({ label, color });
          actions.setBoxStatus(box.id, newId);
          closeSheet();
        }}
      />

      <MarkersSheet
        visible={sheet === SHEET.markers}
        allMarkers={d.allMarkers}
        selected={box.markers}
        onClose={closeSheet}
        onToggle={(markerId) => actions.toggleBoxMarker(box.id, markerId)}
        onCreate={(label, color, icon) => {
          const newId = actions.addMarker({ label, color, icon });
          actions.toggleBoxMarker(box.id, newId);
        }}
      />

      <CoverSheet
        visible={sheet === SHEET.cover}
        hasCover={!!box.cover}
        onClose={closeSheet}
        onCapture={(uri) => {
          actions.setBoxCover(box.id, uri);
          closeSheet();
        }}
        onRemove={() => {
          actions.setBoxCover(box.id, null);
          closeSheet();
        }}
      />

      <EditBoxSheet
        visible={sheet === SHEET.edit}
        box={box}
        rooms={d.rooms}
        onClose={closeSheet}
        onSave={(patch) => {
          actions.updateBox(box.id, patch);
          closeSheet();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceApp },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },

  editLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  editLinkText: { fontFamily: fonts.body.bold, fontSize: 13.5, color: palette.green700 },
  markerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  markerEmpty: { fontFamily: fonts.body.semibold, fontSize: 13.5, color: palette.ink400 },

  bottom: { marginTop: 20 },
  actionRow: { flexDirection: 'row', gap: 10 },
  addItem: { flex: 1 },
  streamItems: { flex: 1.25 },
  proBadge: {
    position: 'absolute',
    top: -7,
    right: 8,
    backgroundColor: palette.amber400,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  proBadgeText: { fontSize: 10, fontFamily: fonts.body.extra, color: palette.ink900, letterSpacing: 0.3 },
});
