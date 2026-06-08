// "Viewing as" demo control — flip Owner / Editor / Viewer to watch the
// same screens gain or lose edit affordances. Surfaces the differentiator.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Role } from '@/data/types';
import { ROLE_LABEL } from '@/lib/permissions';
import { useStore } from '@/store/useStore';
import { colors, fonts, palette, radius, shadow } from '@/theme';

const ROLES: Role[] = ['owner', 'editor', 'viewer'];

export function RoleSwitcher() {
  const role = useStore((s) => s.role);
  const setRole = useStore((s) => s.setRole);

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Viewing as</Text>
      <View style={styles.track}>
        {ROLES.map((r) => {
          const on = r === role;
          return (
            <Pressable key={r} onPress={() => setRole(r)} style={[styles.pill, on && styles.pillOn]}>
              <Text style={[styles.label, on && styles.labelOn]}>{ROLE_LABEL[r]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6 },
  eyebrow: {
    fontFamily: fonts.body.extra,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: palette.ink400,
  },
  track: {
    flexDirection: 'row',
    padding: 4,
    gap: 3,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.pill,
    ...shadow.md,
  },
  pill: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOn: { backgroundColor: colors.brand, ...shadow.brand },
  label: { fontFamily: fonts.body.extra, fontSize: 13, color: palette.ink500 },
  labelOn: { color: colors.textOnBrand },
});
