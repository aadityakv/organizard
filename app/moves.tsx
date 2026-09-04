// Moves home — your library of moves. Empty state hero, an active list, and a
// collapsible archived section. Tapping a move switches into it; the ⋯ menu
// archives / unarchives. A paste sheet routes invite links to /invite.
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Avatar, Button, Header, Icon, IconButton, SlothMark } from '@/components';
import type { Move } from '@/data/types';
import {
  AccountSheet,
  EditMoveSheet,
  JoinSheet,
  MoveMenuSheet,
  MoveRow,
  useMoveLibrary,
} from '@/features/moves';
import { deleteMove } from '@/services/moves';
import type { MoveSummary } from '@/store/library';
import { useStore } from '@/store/useStore';
import { colors, fonts, palette, space } from '@/theme';
import { routes } from '@/lib/routes';
import { copy } from '@/copy/moves';

const EMPTY_MOVE: Move = { name: '', from: '', to: '', target: '' };

/** Moves library: active and archived moves, account sheet, per-move menu and join-by-link. */
export default function Moves() {
  const { summaries, active, archived, account, currentMoveId } = useMoveLibrary();

  const [archivedOpen, setArchivedOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [menuFor, setMenuFor] = useState<MoveSummary | null>(null);
  const [editFor, setEditFor] = useState<MoveSummary | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  const accountButton = (
    <Pressable
      accessibilityRole="button"
      onPress={() => setAccountOpen(true)}
      hitSlop={8}
      accessibilityLabel="Account"
    >
      {account ? (
        <Avatar name={account.name} size={32} />
      ) : (
        <View style={styles.guestAvatar}>
          <Icon name="user" size={18} color={palette.ink500} />
        </View>
      )}
    </Pressable>
  );

  const openMove = (id: string) => {
    useStore.getState().switchMove(id);
    // navigate() de-dupes: it pops back to the existing tabs instance instead of
    // stacking a new one (which corrupted touch/tab handling). See the chevron in
    // the dashboard header — both sides of the moves⇄tabs switch must use navigate.
    router.navigate(routes.tabs);
  };

  const submitJoin = () => {
    // `token=…` may carry trailing query params; keep only the token itself.
    const t = pasted.split('token=')[1]?.split('&')[0].trim() ?? pasted.trim();
    if (t) {
      setJoinOpen(false);
      setPasted('');
      router.push(routes.invite(t));
    }
  };

  // Editing targets the live slice (the current move), so switch into the move
  // first; then open the edit sheet. The summary refreshes via the live-slice sub.
  const openEdit = (move: MoveSummary) => {
    setMenuFor(null);
    if (move.id !== currentMoveId) useStore.getState().switchMove(move.id);
    setEditFor(move);
  };

  const confirmDelete = (move: MoveSummary) => {
    setMenuFor(null);
    Alert.alert(copy.deleteMoveConfirmTitle, `“${move.name}” and its boxes will be permanently deleted.`, [
      { text: copy.cancelButton, style: 'cancel' },
      {
        text: copy.deleteButton,
        style: 'destructive',
        onPress: () => {
          void deleteMove(move.id);
        },
      },
    ]);
  };

  const joinSheet = (
    <JoinSheet
      visible={joinOpen}
      onClose={() => setJoinOpen(false)}
      value={pasted}
      onChange={setPasted}
      onSubmit={submitJoin}
    />
  );
  const accountSheet = <AccountSheet visible={accountOpen} onClose={() => setAccountOpen(false)} />;
  if (summaries.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>{accountButton}</View>
        <View style={styles.emptyShell}>
          <View style={styles.hero}>
            <View style={styles.markGlow}>
              <SlothMark size={96} />
            </View>
            <Text style={styles.wordmark}>
              <Text style={styles.wordmarkInk}>{copy.appName}</Text>
            </Text>
            <Text style={styles.tagline}>{copy.taglineText}</Text>
          </View>
          <View style={styles.emptyActions}>
            <Button size="lg" fullWidth iconLeft="plus" onPress={() => router.push(routes.newMove)}>
              {copy.createMoveButton}
            </Button>
            <Button variant="secondary" size="lg" fullWidth iconLeft="link" onPress={() => setJoinOpen(true)}>
              {copy.joinTitle}
            </Button>
          </View>
        </View>
        {joinSheet}
        {accountSheet}
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header
        title={copy.libraryTitle}
        leading={accountButton}
        trailing={
          <IconButton
            icon="plus"
            variant="brand"
            size="sm"
            accessibilityLabel="New move"
            onPress={() => router.push(routes.newMove)}
          />
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {active.map((m) => (
          <MoveRow key={m.id} move={m} onOpen={() => openMove(m.id)} onMenu={() => setMenuFor(m)} />
        ))}

        <Button
          variant="secondary"
          fullWidth
          iconLeft="link"
          onPress={() => setJoinOpen(true)}
          style={styles.joinCta}
        >
          {copy.joinTitle}
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

      <MoveMenuSheet
        move={menuFor}
        onClose={() => setMenuFor(null)}
        onEdit={openEdit}
        onDelete={confirmDelete}
      />
      <EditMoveSheet
        visible={editFor !== null}
        move={editFor ?? EMPTY_MOVE}
        onClose={() => setEditFor(null)}
      />
      {joinSheet}
      {accountSheet}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceApp },
  content: { paddingHorizontal: 16, paddingBottom: 60, gap: 12 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 16, paddingTop: 8 },
  guestAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },

  joinCta: { marginTop: 4 },
  archivedBlock: { marginTop: 8, gap: 12 },
  archivedHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingLeft: 2 },
  archivedTitle: { fontFamily: fonts.body.extra, fontSize: 14, color: palette.ink700 },
  emptyShell: { flex: 1, paddingHorizontal: space[6] },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  markGlow: {
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

  pressedSoft: { opacity: 0.7 },
});
