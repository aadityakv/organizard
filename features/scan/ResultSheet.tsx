// Bottom sheet over the viewfinder showing what a scanned code resolved to.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Icon } from '@/components';
import { copy } from '@/copy/scan';
import { fonts, palette, radius, shadow, space, pressed } from '@/theme';

import type { ResultView } from './types';

/** What a scan resolved to, with its one action and a "scan again" link. */
export function ResultSheet({ view, onRescan }: { view: ResultView; onRescan: () => void }) {
  return (
    <View style={styles.sheet}>
      <View style={styles.grabber} />
      <View style={styles.sheetHeader}>
        <View style={[styles.resultIcon, { backgroundColor: view.iconWash }]}>
          <Icon name={view.icon} size={26} color={view.iconColor} />
        </View>
        <View style={styles.sheetCopy}>
          <Text style={styles.sheetTitle}>{view.title}</Text>
          <Text style={styles.sheetBody}>{view.body}</Text>
        </View>
      </View>
      <View style={styles.sheetActions}>
        <Button
          variant={view.actionVariant}
          size="lg"
          fullWidth
          iconLeft={view.actionIcon}
          onPress={view.onAction}
        >
          {view.actionLabel}
        </Button>
        {view.actionVariant === 'primary' && (
          <Pressable
            onPress={onRescan}
            style={({ pressed }) => [styles.rescanLink, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Icon name="scan-line" size={16} color={palette.ink500} />
            <Text style={styles.rescanText}>{copy.scanAgainButton}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.white,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingTop: space[5] + 2,
    paddingHorizontal: space[4] + 2,
    paddingBottom: space[8] + 2,
    ...shadow.xl,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: palette.sand400,
    alignSelf: 'center',
    marginBottom: space[4],
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3] + 2,
  },
  resultIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCopy: { flex: 1 },
  sheetTitle: {
    fontFamily: fonts.display.bold,
    fontSize: 18,
    color: palette.ink900,
    lineHeight: 22,
  },
  sheetBody: {
    fontFamily: fonts.body.semibold,
    fontSize: 13,
    color: palette.ink500,
    lineHeight: 19,
    marginTop: 3,
  },
  sheetActions: {
    marginTop: space[4] + 2,
    gap: space[3],
  },
  rescanLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
  },
  rescanText: {
    fontFamily: fonts.body.bold,
    fontSize: 14,
    color: palette.ink500,
  },
  pressed,
});
