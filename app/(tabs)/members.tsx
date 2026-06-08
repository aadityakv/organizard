// Members & sharing — the differentiator. Roster, invite with role, owner-only manage.
// Member mutations (role change / remove) live in LOCAL component state only:
// the store has no member mutators and we must not add any.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Avatar,
  Badge,
  Button,
  Card,
  Header,
  Icon,
  LockNote,
  RoleBadge,
  Sheet,
} from '@/components';
import { PERM, ROLE_BLURB, ROLE_LABEL } from '@/lib/permissions';
import { colors, fonts, fontSize, palette, radius, space } from '@/theme';
import type { Member, Role } from '@/data/types';
import { useStore } from '@/store/useStore';

// Roles a buddy can be invited / changed to (you can't demote/clone an owner here).
const ASSIGNABLE_ROLES: Role[] = ['editor', 'viewer'];
const INVITE_CODE = 'GECKO-4F2';
const INVITE_LINK = 'organizard.app/join/GECKO-4F2';

// ─────────────────────────────────────────────────────────────────────────────
// Role picker — shared by the invite card and the manage sheet.
// ─────────────────────────────────────────────────────────────────────────────
function RolePicker({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <View style={styles.rolePicker}>
      {ASSIGNABLE_ROLES.map((r) => {
        const selected = value === r;
        return (
          <Pressable
            key={r}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${ROLE_LABEL[r]} — ${ROLE_BLURB[r]}`}
            onPress={() => onChange(r)}
            style={({ pressed }) => [
              styles.roleOption,
              selected && styles.roleOptionSelected,
              pressed && styles.pressed,
            ]}
          >
            <RoleBadge role={r} withBlurb style={styles.roleBadgeFill} />
            {selected ? (
              <Icon name="check-circle-2" size={22} color={palette.green600} />
            ) : (
              <View style={styles.radioEmpty} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Invite sheet — visible to every role. Pick a role, copy the link / code.
// ─────────────────────────────────────────────────────────────────────────────
function InviteSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [inviteRole, setInviteRole] = useState<Role>('editor');
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    // No real clipboard binding — a pressed confirmation is enough for the demo.
    setCopied(true);
  };

  // Reset the confirmation whenever the sheet is dismissed.
  const close = () => {
    setCopied(false);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title="Invite a packing buddy">
      <Text style={styles.sheetBlurb}>
        They will join with the role you pick. You can change it anytime.
      </Text>

      <RolePicker value={inviteRole} onChange={setInviteRole} />

      <Button
        variant="primary"
        size="lg"
        fullWidth
        iconLeft={copied ? 'check' : 'link'}
        onPress={copyLink}
        style={styles.sheetCta}
      >
        {copied ? 'Link copied' : 'Copy invite link'}
      </Button>

      <Text style={styles.inviteLink} numberOfLines={1}>
        {INVITE_LINK}
      </Text>

      <View style={styles.codeRow}>
        <Icon name="hash" size={16} color={palette.ink400} />
        <Text style={styles.codeText}>{INVITE_CODE}</Text>
        <Text style={styles.codeHint}>or share this code</Text>
      </View>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Manage sheet — owner only. Change a buddy's role or remove them (local state).
// ─────────────────────────────────────────────────────────────────────────────
function ManageSheet({
  member,
  onClose,
  onChangeRole,
  onRemove,
}: {
  member: Member | null;
  onClose: () => void;
  onChangeRole: (id: string, role: Role) => void;
  onRemove: (id: string) => void;
}) {
  // Seed the picker from the member each time a sheet opens.
  const initialRole: Role = member && member.role !== 'owner' ? member.role : 'editor';
  const [role, setRole] = useState<Role>(initialRole);

  // Keep local picker in sync when a different member is tapped.
  React.useEffect(() => {
    if (member) setRole(member.role === 'owner' ? 'editor' : member.role);
  }, [member]);

  return (
    <Sheet visible={member !== null} onClose={onClose}>
      {member ? (
        <>
          <View style={styles.manageHeader}>
            <Avatar name={member.name} size={48} />
            <View style={styles.manageHeaderText}>
              <Text style={styles.manageName} numberOfLines={1}>
                {member.name}
              </Text>
              <Text style={styles.manageSub}>Choose what they can do</Text>
            </View>
          </View>

          <RolePicker value={role} onChange={setRole} />

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => {
              onChangeRole(member.id, role);
              onClose();
            }}
            style={styles.sheetCta}
          >
            Save role
          </Button>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${member.name} from move`}
            onPress={() => {
              onRemove(member.id);
              onClose();
            }}
            style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
          >
            <Text style={styles.removeText}>Remove from move</Text>
          </Pressable>
        </>
      ) : null}
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function Members() {
  const role = useStore((s) => s.role);
  const storeMembers = useStore((s) => s.members);
  const accountId = useStore((s) => s.account?.id);

  // Member management is LOCAL UI state — the store has no member mutators.
  const [members, setMembers] = useState<Member[]>(storeMembers);
  // Re-seed when the synced roster changes (shared moves) so it doesn't go stale.
  useEffect(() => setMembers(storeMembers), [storeMembers]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [manageMember, setManageMember] = useState<Member | null>(null);

  const isOwner = PERM.canManage(role);
  const ownerMember = useMemo(() => members.find((m) => m.role === 'owner'), [members]);
  const ownerName = ownerMember?.name ?? 'the owner';
  const solo = members.length <= 1;

  const changeRole = (id: string, next: Role) =>
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, role: next } : m)));

  const removeMember = (id: string) => setMembers((ms) => ms.filter((m) => m.id !== id));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header
        title="Members & sharing"
        subtitle={`${members.length} on this move`}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Roster */}
        <Card style={styles.rosterCard}>
          {members.map((m, i) => {
            // Synced rosters (shared moves) don't carry `you`; derive it from the account.
            const you = Boolean(m.you) || m.id === accountId;
            const tappable = isOwner && !you;
            return (
              <Pressable
                key={m.id}
                disabled={!tappable}
                accessibilityRole={tappable ? 'button' : undefined}
                accessibilityLabel={tappable ? `Manage ${m.name}` : undefined}
                onPress={tappable ? () => setManageMember(m) : undefined}
                style={({ pressed }) => [
                  styles.rosterRow,
                  i > 0 && styles.rosterRowDivider,
                  tappable && pressed && styles.pressed,
                ]}
              >
                <Avatar name={m.name} size={44} />
                <View style={styles.rosterBody}>
                  <View style={styles.nameRow}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {m.name}
                    </Text>
                    {you ? <Badge label="You" tone="neutral" size="sm" /> : null}
                  </View>
                  <RoleBadge role={m.role} withBlurb size="sm" style={styles.rosterRole} />
                </View>
                {tappable ? (
                  <Icon name="chevron-right" size={20} color={palette.ink400} />
                ) : null}
              </Pressable>
            );
          })}
        </Card>

        {/* Invite — available to every role */}
        <Card style={styles.inviteCard}>
          {solo ? (
            <View style={styles.soloIcon}>
              <Icon name="user-plus" size={22} color={palette.green700} />
            </View>
          ) : null}
          <Text style={styles.inviteTitle}>
            {solo ? 'You are packing solo' : 'Invite a packing buddy'}
          </Text>
          <Text style={styles.inviteBlurb}>
            {solo
              ? 'Bring in a partner or helper — they can add boxes, scan, and follow along.'
              : 'Share a link and pick what each person can do. You can change it anytime.'}
          </Text>
          <Button
            variant={solo ? 'primary' : 'secondary'}
            size="lg"
            fullWidth
            iconLeft="user-plus"
            onPress={() => setInviteOpen(true)}
            style={styles.inviteBtn}
          >
            Invite someone
          </Button>
        </Card>

        {/* Manage — owner only. Non-owners get the plain-language why. */}
        {!isOwner ? (
          <View style={styles.lockWrap}>
            <LockNote>Only {ownerName} can change roles.</LockNote>
          </View>
        ) : null}
      </ScrollView>

      <InviteSheet visible={inviteOpen} onClose={() => setInviteOpen(false)} />
      <ManageSheet
        member={manageMember}
        onClose={() => setManageMember(null)}
        onChangeRole={changeRole}
        onRemove={removeMember}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceApp,
  },
  scroll: {
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[10],
    gap: space[5],
  },
  pressed: {
    opacity: 0.7,
  },

  // Roster ------------------------------------------------------------------
  rosterCard: {
    overflow: 'hidden',
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    minHeight: 64,
  },
  rosterRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.sand300,
  },
  rosterBody: {
    flex: 1,
    minWidth: 0,
    gap: space[1],
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  memberName: {
    flexShrink: 1,
    fontFamily: fonts.body.extra,
    fontSize: fontSize.md,
    color: palette.ink900,
  },
  rosterRole: {
    alignSelf: 'flex-start',
  },

  // Invite card -------------------------------------------------------------
  inviteCard: {
    padding: space[4],
  },
  soloIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: palette.green50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[3],
  },
  inviteTitle: {
    fontFamily: fonts.display.bold,
    fontSize: fontSize.lg,
    color: palette.ink900,
    marginBottom: space[1],
  },
  inviteBlurb: {
    fontFamily: fonts.body.semibold,
    fontSize: 13.5,
    lineHeight: 19,
    color: palette.ink500,
    marginBottom: space[4],
  },
  inviteBtn: {
    marginTop: space[1],
  },

  // Lock note ---------------------------------------------------------------
  lockWrap: {
    marginHorizontal: -space[4], // LockNote owns its own 16px gutter.
  },

  // Sheet shared ------------------------------------------------------------
  sheetBlurb: {
    fontFamily: fonts.body.semibold,
    fontSize: 13.5,
    lineHeight: 19,
    color: palette.ink500,
    marginBottom: space[4],
  },
  sheetCta: {
    marginTop: space[1],
  },

  // Role picker -------------------------------------------------------------
  rolePicker: {
    gap: space[2],
    marginBottom: space[4],
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: palette.sand300,
    backgroundColor: palette.white,
  },
  roleOptionSelected: {
    borderColor: palette.green400,
    backgroundColor: palette.green50,
  },
  roleBadgeFill: {
    flex: 1,
  },
  radioEmpty: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.sand400,
  },

  // Invite link + code ------------------------------------------------------
  inviteLink: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: palette.green700,
    textAlign: 'center',
    marginTop: space[3],
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginTop: space[3],
    paddingVertical: space[2],
    paddingHorizontal: space[4],
    backgroundColor: palette.cream100,
    borderRadius: radius.md,
  },
  codeText: {
    fontFamily: fonts.body.extra,
    fontSize: fontSize.md,
    letterSpacing: 2,
    color: palette.ink700,
  },
  codeHint: {
    marginLeft: 'auto',
    fontFamily: fonts.body.bold,
    fontSize: fontSize.xs,
    color: palette.ink400,
  },

  // Manage sheet ------------------------------------------------------------
  manageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    marginBottom: space[4],
  },
  manageHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  manageName: {
    fontFamily: fonts.display.bold,
    fontSize: fontSize.lg,
    color: palette.ink900,
  },
  manageSub: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: palette.ink500,
    marginTop: 1,
  },
  removeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: space[2],
  },
  removeText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.base,
    color: colors.danger,
  },
});
