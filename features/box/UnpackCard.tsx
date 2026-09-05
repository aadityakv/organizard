// The way into Unpack mode from a box: one tappable card with how far along the box is.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import { Badge, Icon } from '@/components';
import type { Box } from '@/data/types';
import { STATUS_ID } from '@/data/defaults';
import { routes } from '@/lib/routes';
import { unpackProgress, useStore } from '@/store/useStore';
import { colors, fonts, palette, radius, shadow } from '@/theme';

import { shared } from './styles';
import { copy } from '@/copy/unpack';

/** Progress summary that opens the unpack checklist for this box. */
export function UnpackCard({ box }: { box: Box }) {
  const { done, total } = useStore(useShallow((s) => unpackProgress(s, box.id)));
  const isDone = box.status === STATUS_ID.unpacked;
  const body =
    total === 0
      ? copy.emptyTitle
      : done === 0 && !isDone
        ? copy.cardNotStarted
        : copy.progressLabel(done, total);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${copy.cardTitle}: ${body}`}
      onPress={() => router.push(routes.unpack(box.id))}
      style={({ pressed }) => [styles.card, pressed && shared.pressed]}
    >
      <View style={[styles.iconWrap, isDone && styles.iconWrapDone]}>
        <Icon
          name={isDone ? 'package-check' : 'package-open'}
          size={22}
          color={isDone ? colors.success : palette.ink700}
        />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{copy.cardTitle}</Text>
          {isDone ? <Badge label={copy.cardDone} tone="success" size="sm" /> : null}
        </View>
        <Text style={styles.sub} numberOfLines={1}>
          {body}
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color={palette.ink400} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 18,
    ...shadow.sm,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.cream200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDone: { backgroundColor: colors.successWash },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.display.bold, fontSize: 16, color: palette.ink900 },
  sub: { fontFamily: fonts.body.semibold, fontSize: 13, color: palette.ink500, marginTop: 2 },
});
