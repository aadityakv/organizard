// White rounded surface with a soft shadow — the base card chrome.
import React from 'react';
import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { colors, radius, shadow } from '@/theme';

export function Card({ style, children, ...rest }: ViewProps & { children?: React.ReactNode }) {
  return (
    <View style={[styles.card, style as ViewStyle]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    ...shadow.sm,
  },
});
