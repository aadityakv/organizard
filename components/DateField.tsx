// Target-date input backed by the platform-native date picker
// (@react-native-community/datetimepicker): a wheel/calendar on iOS, the system
// dialog on Android. Tapping the field reveals the picker; the chosen date is
// surfaced to the parent as a Date (formatted to a label for display).
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { Button } from './Button';
import { Icon } from './Icon';
import { colors, fonts, fontSize, palette, radius, space } from '@/theme';

export type DateFieldProps = {
  label?: string;
  value: Date | null;
  onChange: (d: Date) => void;
  placeholder?: string;
};

/** "Jul 12, 2026" — the human label stored alongside the move. */
export const formatTargetDate = (d: Date): string =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function DateField({ label, value, onChange, placeholder = 'Pick a date' }: DateFieldProps) {
  const [show, setShow] = useState(false);

  const onPicked = (event: DateTimePickerEvent, picked?: Date) => {
    // Android's dialog dismisses itself; iOS keeps the inline picker open until Done.
    if (Platform.OS === 'android') setShow(false);
    if (event.type === 'set' && picked) onChange(picked);
  };

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? 'Pick a date'}
        onPress={() => setShow((s) => !s)}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
      >
        <Icon name="calendar" size={18} color={value ? palette.ink700 : palette.ink400} />
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value ? formatTargetDate(value) : placeholder}
        </Text>
        <Icon name={show ? 'chevron-up' : 'chevron-down'} size={18} color={palette.ink400} />
      </Pressable>

      {show ? (
        <View style={Platform.OS === 'ios' ? styles.iosWrap : undefined}>
          <DateTimePicker
            value={value ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={onPicked}
          />
          {Platform.OS === 'ios' ? (
            <Button variant="secondary" size="md" fullWidth onPress={() => setShow(false)}>
              Done
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: colors.textBody,
    marginBottom: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: palette.sand300,
    borderRadius: radius.md,
    backgroundColor: palette.white,
  },
  pressed: { opacity: 0.8 },
  value: { flex: 1, fontFamily: fonts.body.semibold, fontSize: fontSize.base, color: palette.ink900 },
  placeholder: { color: palette.ink400, fontFamily: fonts.body.semibold },
  iosWrap: {
    marginTop: space[2],
    padding: space[2],
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: palette.sand300,
  },
});
