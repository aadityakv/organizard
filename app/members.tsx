// Members & sharing for the open move. Lists the roster with role badges, lets the
// owner change roles and remove members, creates invite links at a chosen role, and
// hosts the "share this move" upgrade for a local move.
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Avatar, AuthPanel, Button, Card, Header, Icon, LockNote, RoleBadge, Segmented } from '@/components';
import type { Member, Role } from '@/data/types';
import { api, ApiError } from '@/lib/api';
import { billingConfigured, configureBilling, isEntitled, purchaseSharing } from '@/lib/billing';
import { createInviteLink, shareMove } from '@/services/share';
import { syncActiveMove } from '@/services/sync';
import { useStore } from '@/store/useStore';
import { colors, fonts, fontSize, palette, radius } from '@/theme';
import { ROLES } from '@/shared';
import { MOVE_MODE } from '@/store/library';
import { copy } from '@/copy/members';

const FRIENDLY_ERROR: Record<string, string> = {
  ENTITLEMENT_REQUIRED: 'A Tuck subscription is required to share a move.',
  FORBIDDEN_ROLE: "You don't have permission to do that.",
  INVITE_INVALID: "That invite link isn't valid.",
  INVITE_USED: 'That invite has already been used.',
  INVITE_EXPIRED: 'That invite link has expired.',
  CANNOT_CHANGE_OWNER: "You can't change the owner's role.",
  CANNOT_REMOVE_OWNER: "You can't remove the owner.",
};

function friendlyError(e: unknown): string {
  if (e instanceof ApiError && FRIENDLY_ERROR[e.code]) return FRIENDLY_ERROR[e.code];
  return e instanceof Error ? e.message : 'Something went wrong.';
}

/** Members & sharing for the open move: roster, role changes, invite links, and the share upgrade. */
export default function Members() {
  const account = useStore((s) => s.account);
  const session = useStore((s) => s.session);
  const activeMode = useStore((s) => s.activeMode);
  const serverMoveId = useStore((s) => s.serverMoveId);
  const members = useStore((s) => s.members);
  const moveName = useStore((s) => s.move.name);

  const [busy, setBusy] = useState(false);
  const [inviteRole, setInviteRole] = useState<Role>(ROLES.editor);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  useEffect(() => {
    if (account?.id) configureBilling(account.id);
  }, [account?.id]);

  // Default to the least-privileged role until membership is known (avoids an owner-controls flash).
  const myRole = members.find((m) => m.id === account?.id)?.role ?? ROLES.viewer;
  const canManage = myRole === ROLES.owner;

  const guard = async (fn: () => Promise<void>, label: string) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert(label, friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const doShare = () =>
    guard(async () => {
      // Paywall: subscription required to own a shared move. Server enforces it too.
      if (billingConfigured() && !(await isEntitled())) {
        const ok = await purchaseSharing();
        if (!ok) return;
      }
      await shareMove();
      await syncActiveMove();
    }, 'Could not share');

  const doInvite = () =>
    guard(async () => {
      setInviteLink(await createInviteLink(inviteRole));
    }, 'Invite failed');

  const changeRole = (userId: string, role: Role) =>
    guard(async () => {
      if (session && serverMoveId) {
        await api.changeRole(session, serverMoveId, userId, role);
        await syncActiveMove();
      }
    }, 'Could not change role');

  const remove = (userId: string) =>
    guard(async () => {
      if (session && serverMoveId) {
        await api.removeMember(session, serverMoveId, userId);
        await syncActiveMove();
      }
    }, 'Could not remove');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title={copy.screenTitle} subtitle={moveName} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!session ? (
          <AuthPanel title={copy.signInToShareButton} subtitle={copy.shareExplainer} />
        ) : activeMode === MOVE_MODE.local ? (
          <>
            <Card style={styles.card}>
              <Text style={styles.h}>Share “{moveName}”</Text>
              <Text style={styles.p}>{copy.thisUploadsTheMoveSo}</Text>
              <Button onPress={doShare} disabled={busy} fullWidth iconLeft="users" style={styles.cta}>
                {busy ? 'Sharing…' : 'Share this move'}
              </Button>
            </Card>
          </>
        ) : (
          <>
            <Card style={styles.card}>
              <Text style={styles.h}>{copy.inviteTitle}</Text>
              {canManage ? (
                <>
                  <Text style={styles.label}>{copy.inviteRoleLabel}</Text>
                  <Segmented
                    options={[
                      { value: ROLES.editor, label: 'Editor' },
                      { value: ROLES.viewer, label: 'Viewer' },
                    ]}
                    value={inviteRole}
                    onChange={(v) => setInviteRole(v as Role)}
                  />
                  <Button
                    onPress={doInvite}
                    disabled={busy}
                    fullWidth
                    iconLeft="user-plus"
                    style={styles.cta}
                  >
                    {copy.createInviteButton}
                  </Button>
                  {inviteLink ? (
                    <Text selectable style={styles.link}>
                      {inviteLink}
                    </Text>
                  ) : null}
                </>
              ) : (
                <LockNote>{copy.inviteLockNote}</LockNote>
              )}
            </Card>

            <Text style={styles.section}>{copy.membersHeading}</Text>
            {members.map((mem) => (
              <MemberRow
                key={mem.id}
                member={mem}
                you={mem.id === account?.id}
                canManage={canManage && mem.role !== ROLES.owner}
                onRole={(r) => changeRole(mem.id, r)}
                onRemove={() => remove(mem.id)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MemberRow({
  member,
  you,
  canManage,
  onRole,
  onRemove,
}: {
  member: Member;
  you: boolean;
  canManage: boolean;
  onRole: (r: Role) => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.memberRow}>
      <Avatar name={member.name} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={styles.memberName} numberOfLines={1}>
          {member.name}
          {you ? ' · You' : ''}
        </Text>
        <RoleBadge role={member.role} size="sm" />
      </View>
      {canManage ? (
        <View style={styles.memberActions}>
          <Segmented
            size="sm"
            options={[
              { value: ROLES.editor, label: 'Editor' },
              { value: ROLES.viewer, label: 'Viewer' },
            ]}
            value={member.role === ROLES.viewer ? ROLES.viewer : ROLES.editor}
            onChange={(v) => onRole(v as Role)}
          />
          <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel="Remove member">
            <Icon name="trash-2" size={18} color={colors.danger} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceApp },
  content: { paddingHorizontal: 16, paddingBottom: 60, gap: 14 },
  card: { padding: 18, gap: 8 },
  h: { fontFamily: fonts.display.bold, fontSize: 20, color: palette.ink900 },
  p: { fontFamily: fonts.body.semibold, fontSize: 14, color: palette.ink500, lineHeight: 20 },
  label: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: palette.ink700,
    marginTop: 8,
    marginBottom: 6,
  },
  cta: { marginTop: 12 },
  or: {
    fontFamily: fonts.body.bold,
    fontSize: 12,
    color: palette.ink400,
    textAlign: 'center',
    marginVertical: 6,
  },
  appleBtn: { height: 48, marginTop: 6 },
  emailFields: { gap: 8, marginTop: 8 },
  hint: {
    fontFamily: fonts.body.semibold,
    fontSize: 12,
    color: palette.ink400,
    textAlign: 'center',
    marginTop: 6,
  },
  link: {
    fontFamily: fonts.body.bold,
    fontSize: 13,
    color: colors.textLink,
    marginTop: 12,
    padding: 12,
    backgroundColor: palette.green50,
    borderRadius: radius.md,
  },
  section: {
    fontFamily: fonts.body.extra,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: palette.ink400,
    marginTop: 8,
    marginLeft: 4,
  },
  accountWrap: { gap: 8 },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: 14,
  },
  deleteAccount: { fontFamily: fonts.body.bold, fontSize: 12.5, color: colors.danger, marginLeft: 6 },
  accountName: { fontFamily: fonts.body.bold, fontSize: 15, color: palette.ink900 },
  accountEmail: { fontFamily: fonts.body.semibold, fontSize: 12.5, color: palette.ink500 },
  signOut: { fontFamily: fonts.body.bold, fontSize: 13, color: colors.danger },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: 12,
  },
  memberName: { fontFamily: fonts.body.bold, fontSize: 15, color: palette.ink900, marginBottom: 4 },
  memberActions: { alignItems: 'flex-end', gap: 8, flexDirection: 'row' },
});
