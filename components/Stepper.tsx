import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, palette, space, radius, fonts, fontSize, tap } from '@/theme';

export type StepperProps = {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

export function Stepper({ value, onChange, min = 1, max = 999, step = 1 }: StepperProps) {
  const set = (next: number) => {
    const clamped = Math.max(min, Math.min(max, next));
    onChange(clamped);
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
        <Text
          style={[
            styles.btnLabel,
            atMin ? styles.btnLabelDisabled : styles.btnLabelEnabled,
          ]}
        >
          {'−'}
        </Text>
      </Pressable>

      {/* Value display */}
      <View style={styles.valueWrap} pointerEvents="none">
        <Text style={styles.valueText}>{value}</Text>
      </View>

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
        <Text
          style={[
            styles.btnLabel,
            atMax ? styles.btnLabelDisabled : styles.btnLabelEnabled,
          ]}
        >
          {'+'}
        </Text>
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
  valueWrap: {
    minWidth: 36,
    alignItems: 'center',
  },
  valueText: {
    fontFamily: fonts.display.semibold,
    fontSize: fontSize.lg, // 20 — close to design's 22px
    lineHeight: 26,
    color: colors.textStrong,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
