// Fallback when the route's box id resolves to nothing (deleted, or a stale link).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Button, Header, Thumb } from '@/components';
import { colors, fonts, fontSize, palette, radius, type as typeTokens } from '@/theme';

export function MissingBox() {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Header title="Box not found" onBack={() => router.back()} />
      <View style={styles.missing}>
        <Thumb color="slate" icon="package-x" size={72} radius={radius.pill} />
        <Text style={styles.missingTitle}>We couldn&apos;t find that box</Text>
        <Text style={styles.missingBody}>It may have been deleted, or the link is out of date.</Text>
        <Button variant="secondary" size="md" iconLeft="arrow-left" onPress={() => router.back()}>
          Go back
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceApp },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  missingTitle: {
    ...typeTokens.heading,
    color: palette.ink900,
    textAlign: 'center',
    marginTop: 8,
  },
  missingBody: {
    fontFamily: fonts.body.semibold,
    fontSize: fontSize.base,
    color: palette.ink500,
    textAlign: 'center',
    marginBottom: 8,
  },
});
