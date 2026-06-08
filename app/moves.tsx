// Moves home — your library of moves. Empty state hero, an active list, and a
// collapsible archived section. Tapping a move switches into it; the ⋯ menu
// archives / unarchives. A paste sheet routes invite links to /invite.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import { Badge, Button, GeckoMark, Header, Icon, IconButton, Input, Sheet } from '@/components';
import { moveSummaries, useStore } from '@/store/useStore';
import type { MoveSummary } from '@/store/library';
import { colors, fonts, palette, radius, shadow, space } from '@/theme';

// ─────────────────────────────────────────────────────────────
// A single move row — name, route, target, meta + Local/Shared badge.
// Tapping switches into the move; ⋯ opens a per-move menu.
// ─────────────────────────────────────────────────────────────
function MoveRow({ move, onOpen, onMenu }: { move: MoveSummary; onOpen: () => void; onMenu: () => void }) {
  const route =
    move.from && move.to ? `${move.from} → ${move.to}` : move.from || move.to || '';
  const shared = move.mode === 'shared';

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${move.name}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.rowBody, pressed && styles.pressedSoft]}
      >
        <View style={styles.rowText}>
          <View style={styles.rowTitleLine}>
            <Text style={styles.rowName} numberOfLines={1}>
              {move.name}
            </Text>
            <Badge label={shared ? 'Shared' : 'Local'} tone={shared ? 'info' : 'neutral'} size="sm" />
          </View>
          {route ? (
            <Text style={styles.rowRoute} numberOfLines={1}>
              {route}
            </Text>
          ) : null}
          {move.target ? <Text style={styles.rowTarget}>Target · {move.target}</Text> : null}
          <Text style={styles.rowMeta}>
            {move.boxCount} {move.boxCount === 1 ? 'box' : 'boxes'} · {move.itemCount}{' '}
            {move.itemCount === 1 ? 'item' : 'items'}
          </Text>
        </View>
      </Pressable>
      <IconButton
        icon="ellipsis"
        variant="ghost"
        size="sm"
        accessibilityLabel={`More options for ${move.name}`}
        onPress={onMenu}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────
export default function Moves() {
  const summaries = useStore(useShallow(moveSummaries));

  const [archivedOpen, setArchivedOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [menuFor, setMenuFor] = useState<MoveSummary | null>(null);

  const active = summaries.filter((s) => !s.archived);
  const archived = summaries.filter((s) => s.archived);

  const openMove = (id: string) => {
    useStore.getState().switchMove(id);
    router.replace('/(tabs)');
  };

  const submitJoin = () => {
    const t = pasted.split('token=')[1]?.trim() ?? pasted.trim();
    if (t) {
      setJoinOpen(false);
      setPasted('');
      router.push(`/invite?token=${encodeURIComponent(t)}`);
    }
  };

  // ── Empty state ───────────────────────────────────────────
  if (summaries.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.emptyShell}>
          <View style={styles.hero}>
            <View style={styles.geckoGlow}>
              <GeckoMark size={96} />
            </View>
            <Text style={styles.wordmark}>
              <Text style={styles.wordmarkAccent}>Organi</Text>
              <Text style={styles.wordmarkInk}>zard</Text>
            </Text>
            <Text style={styles.tagline}>Pack fast. Find anything. Share the load.</Text>
          </View>
          <View style={styles.emptyActions}>
            <Button size="lg" fullWidth iconLeft="plus" onPress={() => router.push('/new-move')}>
              Create a move
            </Button>
            <Button variant="secondary" size="lg" fullWidth iconLeft="link" onPress={() => setJoinOpen(true)}>
              Join a move
            </Button>
          </View>
        </View>
        <JoinSheet
          visible={joinOpen}
          onClose={() => setJoinOpen(false)}
          value={pasted}
          onChange={setPasted}
          onSubmit={submitJoin}
        />
      </SafeAreaView>
    );
  }

  // ── Populated library ─────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header
        title="Your moves"
        trailing={
          <IconButton
            icon="plus"
            variant="brand"
            size="sm"
            accessibilityLabel="New move"
            onPress={() => router.push('/new-move')}
          />
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {active.map((m) => (
          <MoveRow key={m.id} move={m} onOpen={() => openMove(m.id)} onMenu={() => setMenuFor(m)} />
        ))}

        <Button variant="secondary" fullWidth iconLeft="link" onPress={() => setJoinOpen(true)} style={styles.joinCta}>
          Join a move
        </Button>

        {archived.length > 0 && (
          <View style={styles.archivedBlock}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${archivedOpen ? 'Collapse' : 'Expand'} archived moves`}
              onPress={() => setArchivedOpen((v) => !v)}
              style={({ pressed }) => [styles.archivedHeader, pressed && styles.pressedSoft]}
            >
              <Icon name={archivedOpen ? 'chevron-down' : 'chevron-right'} size={18} color={palette.ink500} />
              <Text style={styles.archivedTitle}>Archived ({archived.length})</Text>
            </Pressable>
            {archivedOpen &&
              archived.map((m) => (
                <MoveRow key={m.id} move={m} onOpen={() => openMove(m.id)} onMenu={() => setMenuFor(m)} />
              ))}
          </View>
        )}
      </ScrollView>

      {/* Per-move menu — Archive / Unarchive */}
      <Sheet visible={menuFor !== null} onClose={() => setMenuFor(null)} title={menuFor?.name}>
        {menuFor?.archived ? (
          <Button
            variant="secondary"
            fullWidth
            iconLeft="archive-restore"
            onPress={() => {
              useStore.getState().unarchiveMove(menuFor.id);
              setMenuFor(null);
            }}
          >
            Unarchive
          </Button>
        ) : (
          <Button
            variant="secondary"
            fullWidth
            iconLeft="archive"
            onPress={() => {
              if (menuFor) useStore.getState().archiveMove(menuFor.id);
              setMenuFor(null);
            }}
          >
            Archive
          </Button>
        )}
      </Sheet>

      <JoinSheet
        visible={joinOpen}
        onClose={() => setJoinOpen(false)}
        value={pasted}
        onChange={setPasted}
        onSubmit={submitJoin}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// Join paste sheet
// ─────────────────────────────────────────────────────────────
function JoinSheet({
  visible,
  onClose,
  value,
  onChange,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  value: string;
  onChange: (t: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Join a move">
      <Text style={styles.sheetBody}>Paste the invite link or code a friend shared with you.</Text>
      <Input value={value} onChangeText={onChange} placeholder="Paste invite link or code" autoFocus />
      <Button fullWidth iconLeft="link" onPress={onSubmit} disabled={!value.trim()} style={styles.sheetCta}>
        Join
      </Button>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceApp },
  content: { paddingHorizontal: 16, paddingBottom: 60, gap: 12 },

  // ── Move row ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    paddingLeft: 16,
    paddingRight: 6,
    ...shadow.sm,
  },
  rowBody: { flex: 1, paddingVertical: 14 },
  rowText: { gap: 3, minWidth: 0 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { fontFamily: fonts.display.bold, fontSize: 18, color: palette.ink900, flexShrink: 1 },
  rowRoute: { fontFamily: fonts.body.bold, fontSize: 13.5, color: palette.ink700 },
  rowTarget: { fontFamily: fonts.body.semibold, fontSize: 12.5, color: palette.ink500 },
  rowMeta: { fontFamily: fonts.body.semibold, fontSize: 12.5, color: palette.ink400, marginTop: 1 },

  joinCta: { marginTop: 4 },

  // ── Archived ──
  archivedBlock: { marginTop: 8, gap: 12 },
  archivedHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingLeft: 2 },
  archivedTitle: { fontFamily: fonts.body.extra, fontSize: 14, color: palette.ink700 },

  // ── Empty state ──
  emptyShell: { flex: 1, paddingHorizontal: space[6] },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  geckoGlow: {
    shadowColor: colors.brand,
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  wordmark: {
    marginTop: 14,
    fontFamily: fonts.display.bold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  wordmarkAccent: { fontFamily: fonts.display.bold, color: palette.green600 },
  wordmarkInk: { fontFamily: fonts.display.bold, color: palette.ink900 },
  tagline: {
    marginTop: 6,
    maxWidth: 260,
    fontFamily: fonts.body.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: palette.ink500,
    textAlign: 'center',
  },
  emptyActions: { gap: space[3], paddingBottom: space[5] },

  // ── Sheets ──
  sheetBody: { fontFamily: fonts.body.semibold, fontSize: 14, color: palette.ink500, lineHeight: 20, marginBottom: 14 },
  sheetCta: { marginTop: 16 },

  pressedSoft: { opacity: 0.7 },
});
