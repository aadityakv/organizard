// A plain-language "why you can't do this" note for gated affordances.
// Never a dead button — always explain.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, palette, radius } from '@/theme';
import { Icon } from './Icon';

/** Plain-language note shown in place of an action the current role cannot perform. */
export function LockNote({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.note}>
      <Icon name="lock" size={15} color={palette.ink400} />
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    backgroundColor: palette.cream200,
    borderRadius: radius.md,
  },
  text: { flex: 1, fontFamily: fonts.body.semibold, fontSize: 13, color: palette.ink500 },
});
