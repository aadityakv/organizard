// Fallback when the route's box id resolves to nothing (deleted, or a stale link).
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Header, Thumb } from '@/components';
import { colors, fonts, fontSize, palette, radius, type as typeTokens } from '@/theme';
import { copy } from '@/copy/box';
import { goBack } from '@/lib/navigation';

/** Fallback screen when the route's box id no longer exists. */
export function MissingBox() {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Header title={copy.boxNotFoundHeader} onBack={goBack} />
      <View style={styles.missing}>
        <Thumb color="slate" icon="package-x" size={72} radius={radius.pill} />
        <Text style={styles.missingTitle}>{copy.missingBoxTitle}</Text>
        <Text style={styles.missingBody}>{copy.missingBoxBody}</Text>
        <Button variant="secondary" size="md" iconLeft="arrow-left" onPress={goBack}>
          {copy.goBackButton}
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
