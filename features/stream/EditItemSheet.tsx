// "Fix this item": name, value and quantity for one captured item, or remove it.
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';

import { Button, Sheet } from '@/components';
import { iconFor } from '@/lib/voice/streamParse';
import { fonts, palette } from '@/theme';

import type { SItem } from './types';
import { copy } from '@/copy/stream';

type Props = {
  item: SItem | null;
  onPatch: (patch: Partial<SItem>) => void;
  onRemove: () => void;
  onClose: () => void;
};

/** Sheet to fix a captured item's name, quantity or value, or remove it. */
export function EditItemSheet({ item, onPatch, onRemove, onClose }: Props) {
  return (
    <Sheet visible={!!item} onClose={onClose} title={copy.fixItemTitle}>
      {/* Keyed per item: the fields remount for each capture so their draft state
          (the value text as typed) resets instead of leaking across items. */}
      {item ? (
        <Fields key={item.id} item={item} onPatch={onPatch} onRemove={onRemove} onClose={onClose} />
      ) : null}
    </Sheet>
  );
}

function Fields({
  item,
  onPatch,
  onRemove,
  onClose,
}: {
  item: SItem;
  onPatch: (patch: Partial<SItem>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  // The value field's text is local draft state: a controlled value straight off
  // parseFloat() would eat the decimal separator while composing ("0." → "0"),
  // which is how 0.5 used to turn into 5. Parse only to patch and on Done.
  const [valueText, setValueText] = useState(item.value != null ? String(item.value) : '');

  const parseValue = (text: string): number | null => {
    const c = text.replace(/[^0-9.]/g, '');
    if (c === '') return null;
    const n = Number.parseFloat(c);
    // Stay under the server's valueCents cap so the commit can't be rejected.
    return Number.isFinite(n) ? Math.min(n, 9_999_999) : null;
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <Text style={styles.fieldLabel}>{copy.itemNameLabel}</Text>
        <TextInput
          value={item.name === 'Untitled item' && item.needsFix ? '' : item.name}
          onChangeText={(v) => onPatch({ name: v, icon: iconFor(v), needsFix: false })}
          placeholder={copy.itemNamePlaceholder}
          placeholderTextColor={palette.ink400}
          style={styles.input}
          maxLength={200}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.fieldLabel}>{copy.valueLabel}</Text>
          <View style={styles.valInputWrap}>
            <Text style={styles.dollar}>$</Text>
            <TextInput
              value={valueText}
              onChangeText={(v) => {
                setValueText(v);
                onPatch({ value: parseValue(v) });
              }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={palette.ink400}
              style={styles.valInput}
            />
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <Text style={styles.fieldLabel}>{copy.quantityLabel}</Text>
          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onPatch({ qty: Math.max(1, (item.qty || 1) - 1) })}
              style={styles.stepBtn}
            >
              <Text style={styles.stepTxt}>−</Text>
            </Pressable>
            <Text style={styles.qtyVal}>{item.qty || 1}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => onPatch({ qty: Math.min(9999, (item.qty || 1) + 1) })}
              style={styles.stepBtn}
            >
              <Text style={styles.stepTxt}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        <Button variant="danger" iconLeft="trash-2" onPress={onRemove}>
          {copy.removeButton}
        </Button>
        <View style={{ flex: 1 }}>
          <Button
            fullWidth
            onPress={() => {
              onPatch({
                name: item.name.trim() || 'Untitled item',
                needsFix: !item.name.trim(),
                value: parseValue(valueText),
              });
              onClose();
            }}
          >
            Done
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 13, fontFamily: fonts.body.bold, color: palette.ink700 },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: palette.sand300,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: fonts.body.bold,
    fontSize: 16,
    color: palette.ink900,
  },
  valInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1.5,
    borderColor: palette.sand300,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 8,
  },
  dollar: { color: palette.ink400, fontFamily: fonts.body.extra },
  valInput: { flex: 1, fontFamily: fonts.body.bold, fontSize: 16, color: palette.ink900 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 48,
    borderWidth: 1.5,
    borderColor: palette.sand300,
    borderRadius: 14,
    paddingHorizontal: 6,
  },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.cream200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTxt: { fontSize: 18, fontFamily: fonts.body.extra, color: palette.ink700 },
  qtyVal: {
    minWidth: 32,
    textAlign: 'center',
    fontFamily: fonts.body.extra,
    fontSize: 16,
    color: palette.ink900,
  },
});
