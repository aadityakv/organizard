// Edit-move sheet — name / from / to / target date, prefilled from `move`. Always
// edits the LIVE slice (updateMove), so callers on the library screen switch into
// the move before opening this. The date string round-trips via formatTargetDate:
// parse move.target to a Date for the picker, write the formatted label (or '' to
// clear) back on save.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AddressField,
  Button,
  DateField,
  formatTargetDate,
  Input,
  parseTargetDate,
  Sheet,
} from '@/components';
import type { Move } from '@/data/types';
import { useSheetForm } from '@/hooks/useSheetForm';
import { useStore } from '@/store/useStore';
import { fonts, palette } from '@/theme';

export function EditMoveSheet({
  visible,
  move,
  onClose,
}: {
  visible: boolean;
  move: Move;
  onClose: () => void;
}) {
  const updateMove = useStore((s) => s.updateMove);
  const [{ name, from, to, date }, patch] = useSheetForm(visible, () => ({
    name: move.name ?? '',
    from: move.from ?? '',
    to: move.to ?? '',
    date: parseTargetDate(move.target),
  }));

  const canSave = name.trim().length > 0;

  const save = (): void => {
    if (!canSave) return;
    updateMove({
      name: name.trim(),
      from: from.trim(),
      to: to.trim(),
      target: date ? formatTargetDate(date) : '',
    });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Edit move">
      <Input
        label="Move name"
        value={name}
        onChangeText={(name) => patch({ name })}
        placeholder="e.g. NYC Move"
        autoFocus
      />
      <View style={styles.fieldGap} />
      <Text style={styles.editLabel}>From</Text>
      <AddressField value={from} onChangeText={(from) => patch({ from })} placeholder="Current address" />
      <View style={styles.fieldGap} />
      <Text style={styles.editLabel}>To</Text>
      <AddressField value={to} onChangeText={(to) => patch({ to })} placeholder="New address" />
      <View style={styles.fieldGap} />
      <Text style={styles.editLabel}>Target date</Text>
      <DateField value={date} onChange={(date) => patch({ date })} placeholder="Pick a move date" />
      <Button fullWidth iconLeft="check" onPress={save} disabled={!canSave} style={styles.sheetCta}>
        Save changes
      </Button>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fieldGap: { height: 14 },
  editLabel: { fontFamily: fonts.body.bold, fontSize: 14, color: palette.ink700, marginBottom: 8 },
  sheetCta: { marginTop: 16 },
});
