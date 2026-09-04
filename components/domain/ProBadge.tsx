// The small amber "PRO" pill that marks Pro-gated affordances while the user is
// not Pro (box detail's stream button, the capture screen's switch pill).
import { StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';

import { palette, fonts } from '@/theme';

export type ProBadgeProps = {
  label: string;
  style?: StyleProp<ViewStyle>;
};

/** Amber PRO pill. Rendered only when the feature is gated for this user. */
export function ProBadge({ label, style }: ProBadgeProps) {
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: palette.amber400,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  text: { fontSize: 10, fontFamily: fonts.body.extra, color: palette.ink900, letterSpacing: 0.3 },
});
