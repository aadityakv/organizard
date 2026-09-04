// The item's own fields: name, price (each), quantity, and notes.
import { StyleSheet, Text, View } from 'react-native';

import { Input, Stepper } from '@/components';
import { money } from '@/lib/money';
import { colors, fonts, fontSize, palette, radius, space } from '@/theme';

import { KBD_ACCESSORY } from './constants';
import { copy } from '@/copy/addItem';

/** The item form fields: name, price, quantity, computed total and notes. */
export function ItemFields({
  isEdit,
  name,
  value,
  qty,
  note,
  parsedValue,
  onName,
  onValue,
  onQty,
  onNote,
}: {
  isEdit: boolean;
  name: string;
  value: string;
  qty: number;
  note: string;
  parsedValue: number;
  onName: (v: string) => void;
  onValue: (v: string) => void;
  onQty: (n: number) => void;
  onNote: (v: string) => void;
}) {
  return (
    <>
      <Input
        label={copy.itemName}
        value={name}
        onChangeText={onName}
        placeholder={copy.itemNamePlaceholder}
        // Only pop the keyboard when CREATING a new item. When editing an
        // existing one you're usually just glancing/tweaking — don't hijack focus.
        autoFocus={!isEdit}
        maxLength={200}
      />

      <View style={styles.fieldRow}>
        <Input
          label={copy.priceLabel}
          value={value}
          onChangeText={onValue}
          placeholder="0"
          keyboardType="decimal-pad"
          prefix="$"
          inputAccessoryViewID={KBD_ACCESSORY}
          style={styles.valueField}
        />
        <View style={styles.qtyField}>
          <Text style={styles.qtyLabel}>{copy.quantityLabel}</Text>
          <View style={styles.qtyBox}>
            <Stepper value={qty} onChange={onQty} inputAccessoryViewID={KBD_ACCESSORY} />
          </View>
        </View>
      </View>

      {parsedValue > 0 && qty > 1 ? (
        <Text style={styles.totalNote}>
          Total: <Text style={styles.totalStrong}>{money(parsedValue * qty)}</Text>
          {`  ·  ${qty} × ${money(parsedValue)}`}
        </Text>
      ) : null}

      <Input
        label={copy.notesLabel}
        value={note}
        onChangeText={onNote}
        placeholder={copy.notesPlaceholder}
        inputAccessoryViewID={KBD_ACCESSORY}
        multiline
        maxLength={4000}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[3],
  },
  valueField: {
    flex: 1,
  },
  totalNote: {
    marginTop: -2,
    fontFamily: fonts.body.semibold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  totalStrong: {
    fontFamily: fonts.display.bold,
    color: palette.green600,
  },
  qtyField: {
    gap: 6,
  },
  qtyLabel: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: colors.textBody,
    marginBottom: 6,
  },
  qtyBox: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: space[1] + 2,
    borderWidth: 1.5,
    borderColor: palette.sand300,
    borderRadius: radius.md,
    backgroundColor: palette.white,
  },
});
