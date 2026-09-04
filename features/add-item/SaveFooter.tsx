// Bottom actions: Save / Save & add another (create), Save changes (edit), or the
// lock note for viewers. Also the "Added N items" confirmation between saves.
import { StyleSheet, Text, View } from 'react-native';

import { Button, Icon, LockNote } from '@/components';
import { colors, fonts, fontSize, gutter, palette, space } from '@/theme';
import { countOf } from '@/lib/text';

/** Sticky footer: Save / Save & add another / Save changes, or a lock note for viewers. */
export function SaveFooter({
  canEdit,
  isEdit,
  addedCount,
  onSave,
  onSaveEdit,
}: {
  canEdit: boolean;
  isEdit: boolean;
  addedCount: number;
  onSave: (another: boolean) => void;
  onSaveEdit: () => void;
}) {
  return (
    <View style={styles.footer}>
      {addedCount > 0 ? (
        <View style={styles.addedRow}>
          <Icon name="check-circle-2" size={16} color={colors.success} />
          <Text style={styles.addedText}>Added {countOf(addedCount, 'item')} to this box</Text>
        </View>
      ) : null}

      {canEdit ? (
        isEdit ? (
          <Button variant="primary" size="lg" fullWidth onPress={onSaveEdit}>
            Save changes
          </Button>
        ) : (
          <View style={styles.actionRow}>
            <Button variant="secondary" size="lg" onPress={() => onSave(false)} style={styles.saveBtn}>
              Save
            </Button>
            <Button
              variant="primary"
              size="lg"
              iconLeft="plus"
              onPress={() => onSave(true)}
              style={styles.saveAnotherBtn}
            >
              Save & add another
            </Button>
          </View>
        )
      ) : (
        <LockNote>You can view and scan, but only an editor can add items.</LockNote>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: gutter,
    paddingTop: space[3],
    paddingBottom: space[2],
    backgroundColor: colors.surfaceApp,
    borderTopWidth: 1,
    borderTopColor: palette.sand300,
  },
  addedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: space[2] + 2,
  },
  addedText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: colors.success,
  },
  actionRow: {
    flexDirection: 'row',
    gap: space[2] + 2,
  },
  saveBtn: {
    flex: 1,
  },
  saveAnotherBtn: {
    flex: 1.5,
  },
});
