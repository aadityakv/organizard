// Standard screen header: optional back, leading slot, title + subtitle, trailing actions.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, palette, radius } from '@/theme';
import { Icon } from './Icon';

export type HeaderProps = {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onBack?: () => void;
};

/** Screen header: optional back button, title/subtitle and leading/trailing slots. */
export function Header({ title, subtitle, leading, trailing, onBack }: HeaderProps) {
  return (
    <View style={styles.row}>
      {onBack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <Icon name="chevron-left" size={22} color={colors.textBody} />
        </Pressable>
      )}
      {leading}
      <View style={styles.titles}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 12,
    minHeight: 44,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: palette.cream200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: { opacity: 0.7 },
  titles: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.display.bold, fontSize: 22, lineHeight: 26, color: palette.ink900 },
  subtitle: { fontFamily: fonts.body.bold, fontSize: 12.5, color: palette.ink500, marginTop: 1 },
  trailing: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
