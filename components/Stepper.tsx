import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { colors, palette, space, radius, fonts, fontSize } from '@/theme';

export type StepperProps = {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** iOS: attach a keyboard accessory (e.g. a Done bar) to the typable field. */
  inputAccessoryViewID?: string;
};

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 999,
  step = 1,
  inputAccessoryViewID,
}: StepperProps) {
  const set = (next: number) => {
    onChange(Math.max(min, Math.min(max, next)));
  };

  // Local text so you can clear and retype the number (e.g. type "80" directly
  // instead of tapping + eighty times). Kept in sync when value changes via +/-.
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);

  const onText = (t: string) => {
    const digits = t.replace(/[^0-9]/g, '');
    setText(digits);
    if (digits.length === 0) return; // allow an empty field mid-edit
    set(parseInt(digits, 10));
  };

  const onBlur = () => {
    const n = parseInt(text, 10);
    const clamped = Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : value;
    setText(String(clamped));
    if (clamped !== value) onChange(clamped);
  };

  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <View style={styles.row}>
      {/* Decrement button */}
      <Pressable
        onPress={() => set(value - step)}
        disabled={atMin}
        accessibilityRole="button"
        accessibilityLabel="Decrease"
        accessibilityState={{ disabled: atMin }}
        style={({ pressed }) => [
          styles.btn,
          atMin ? styles.btnDisabled : styles.btnEnabled,
          pressed && !atMin && styles.btnPressed,
        ]}
        hitSlop={4}
      >
        <Text style={[styles.btnLabel, atMin ? styles.btnLabelDisabled : styles.btnLabelEnabled]}>{'−'}</Text>
      </Pressable>

      {/* Editable value — type a number directly, or use the buttons */}
      <TextInput
        value={text}
        onChangeText={onText}
        onBlur={onBlur}
        keyboardType="number-pad"
        selectTextOnFocus
        maxLength={String(max).length}
        inputAccessoryViewID={inputAccessoryViewID}
        accessibilityLabel="Quantity"
        style={styles.valueInput}
      />

      {/* Increment button */}
      <Pressable
        onPress={() => set(value + step)}
        disabled={atMax}
        accessibilityRole="button"
        accessibilityLabel="Increase"
        accessibilityState={{ disabled: atMax }}
        style={({ pressed }) => [
          styles.btn,
          atMax ? styles.btnDisabled : styles.btnEnabled,
          pressed && !atMax && styles.btnPressed,
        ]}
        hitSlop={4}
      >
        <Text style={[styles.btnLabel, atMax ? styles.btnLabelDisabled : styles.btnLabelEnabled]}>{'+'}</Text>
      </Pressable>
    </View>
  );
}

const BTN_SIZE = 44; // Meets 44px tap target

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3], // 12px — matches design gap: 12
  },
  btn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  btnEnabled: {
    backgroundColor: palette.green50,
  },
  btnDisabled: {
    backgroundColor: palette.cream200,
  },
  btnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  btnLabel: {
    fontFamily: fonts.display.bold,
    fontSize: fontSize.lg, // 20 — close to design's 22px
    lineHeight: 24,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  btnLabelEnabled: {
    color: palette.green700,
  },
  btnLabelDisabled: {
    color: palette.sand400,
  },
  valueInput: {
    minWidth: 44,
    paddingHorizontal: 4,
    paddingVertical: 0,
    fontFamily: fonts.display.semibold,
    fontSize: fontSize.lg, // 20
    lineHeight: 26,
    color: colors.textStrong,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
