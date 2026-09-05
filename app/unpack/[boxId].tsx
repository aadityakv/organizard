// Unpack a box — the checklist you work through at the new place: tick items as they
// come out, watch the progress fill, and the box flips to Unpacked on the last tick.
// Reached from the box screen's Unpack card and from a scan. Viewers see it read-only.
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Badge, Button, Header, Icon, LockNote, RoomGlyph } from '@/components';
import { MissingBox } from '@/features/box';
import { UnpackRow, useUnpack } from '@/features/unpack';
import { goBack } from '@/lib/navigation';
import { roomLabel } from '@/lib/text';
import { boxColor, boxTint, colors, fonts, palette, radius, shadow, space } from '@/theme';
import { copy } from '@/copy/unpack';

/** Unpack checklist for one box. */
export default function Unpack() {
  const { boxId } = useLocalSearchParams<{ boxId: string }>();
  const d = useUnpack(boxId ?? '');
  const { box, room, items, progress, canEdit, isDone, session, actions } = d;
  if (!box) return <MissingBox />;

  // One view state, derived from both the status and the ticks, so the banner, the
  // empty card and the footer never contradict each other: a box set to Unpacked by
  // hand with items still un-ticked keeps its "mark all" button, and an empty box
  // closed out shows only the done banner.
  const { done, total } = progress;
  const allTicked = total > 0 && done === total;
  const showDone = isDone && (total === 0 || allTicked);
  const showEmpty = total === 0 && !isDone;
  const canMarkAll = canEdit && !(isDone && (total === 0 || allTicked));
  const pct = total > 0 ? Math.round((done / total) * 100) : isDone ? 100 : 0;

  const toggle = (itemId: string, on: boolean) => {
    actions.setItemUnpacked(box.id, itemId, on);
    if (on) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };
  const markAll = () => {
    actions.unpackBox(box.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={[styles.hero, { backgroundColor: boxTint(box.color) }]}>
        <Header
          title={`#${box.number} · ${box.name}`}
          subtitle={roomLabel(room)}
          onBack={goBack}
          leading={room ? <RoomGlyph icon={room.icon} color={room.color} size={28} /> : undefined}
        />
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>{copy.progressLabel(done, total)}</Text>
          {isDone ? <Badge label={copy.cardDone} tone="success" /> : null}
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%`, backgroundColor: boxColor(box.color) }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {showDone ? (
          <View style={styles.done}>
            <Icon name="package-check" size={22} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.doneTitle}>{copy.doneTitle}</Text>
              <Text style={styles.doneBody}>{copy.doneBody}</Text>
            </View>
          </View>
        ) : null}

        {showEmpty ? (
          <View style={styles.empty}>
            <Icon name="package-open" size={32} color={palette.ink400} />
            <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
            <Text style={styles.emptyBody}>{copy.emptyBody}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {items.map((it) => (
              <UnpackRow
                key={it.id}
                item={it}
                boxColor={box.color}
                session={session}
                onToggle={canEdit ? (on) => toggle(it.id, on) : undefined}
              />
            ))}
          </View>
        )}

        <View style={styles.bottom}>
          {!canEdit ? (
            <LockNote>{copy.viewerNote}</LockNote>
          ) : canMarkAll ? (
            <Button variant="primary" size="lg" fullWidth iconLeft="package-check" onPress={markAll}>
              {copy.markBoxButton}
            </Button>
          ) : (
            <Button variant="secondary" size="lg" fullWidth iconLeft="chevron-left" onPress={goBack}>
              {copy.backToBoxButton}
            </Button>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceApp },
  hero: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.sand300 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: space[2],
  },
  progressText: { fontFamily: fonts.display.bold, fontSize: 16, color: palette.ink900 },
  track: {
    height: 8,
    marginHorizontal: 18,
    marginBottom: space[4],
    borderRadius: radius.pill,
    backgroundColor: palette.white,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  list: { gap: 8 },
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.successWash,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 14,
  },
  doneTitle: { fontFamily: fonts.display.bold, fontSize: 16, color: palette.green700 },
  doneBody: { fontFamily: fonts.body.semibold, fontSize: 13, color: palette.ink500, marginTop: 2 },
  empty: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    ...shadow.sm,
  },
  emptyTitle: { fontFamily: fonts.display.bold, fontSize: 17, color: palette.ink900, marginTop: 8 },
  emptyBody: { fontFamily: fonts.body.semibold, fontSize: 14, color: palette.ink500, textAlign: 'center' },
  bottom: { marginTop: 20 },
});
