// Target-date input backed by a self-contained JS month calendar (no native
// module — avoids the New-Architecture/Fabric coupling that ships-broken on this
// app's New-Arch-OFF setup). Tapping the field opens a Sheet with a tappable
// month grid; the chosen date is surfaced to the parent as a Date.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { Sheet } from './Sheet';
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

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function DateField({ label, value, onChange, placeholder = 'Pick a date' }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  // The month currently shown in the grid (defaults to the selection or today).
  const [view, setView] = useState<Date>(() => {
    const base = value ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const today = new Date();
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Leading blanks for alignment, then the days.
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const shiftMonth = (delta: number) => setView(new Date(year, month + delta, 1));
  const pick = (day: number) => {
    onChange(new Date(year, month, day));
    setOpen(false);
  };

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? 'Pick a date'}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
      >
        <Icon name="calendar" size={18} color={value ? palette.ink700 : palette.ink400} />
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value ? formatTargetDate(value) : placeholder}
        </Text>
        <Icon name="chevron-down" size={18} color={palette.ink400} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Target date">
        <View style={styles.calHeader}>
          <Pressable
            accessibilityLabel="Previous month"
            onPress={() => shiftMonth(-1)}
            hitSlop={8}
            style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
          >
            <Icon name="chevron-left" size={20} color={palette.ink700} />
          </Pressable>
          <Text style={styles.monthLabel}>
            {MONTHS[month]} {year}
          </Text>
          <Pressable
            accessibilityLabel="Next month"
            onPress={() => shiftMonth(1)}
            hitSlop={8}
            style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
          >
            <Icon name="chevron-right" size={20} color={palette.ink700} />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAYS.map((d, i) => (
            <Text key={i} style={styles.weekday}>
              {d}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((day, i) => {
            if (day === null) return <View key={`b${i}`} style={styles.cell} />;
            const date = new Date(year, month, day);
            const selected = value != null && sameDay(date, value);
            const isToday = sameDay(date, today);
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={formatTargetDate(date)}
                onPress={() => pick(day)}
                style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
              >
                <View style={[styles.dayDot, selected && styles.daySelected]}>
                  <Text style={[styles.dayText, selected && styles.dayTextSelected, isToday && !selected && styles.dayToday]}>
                    {day}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
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
  pressed: { opacity: 0.7 },
  value: { flex: 1, fontFamily: fonts.body.semibold, fontSize: fontSize.base, color: palette.ink900 },
  placeholder: { color: palette.ink400, fontFamily: fonts.body.semibold },

  // Calendar
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[3],
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cream100,
  },
  monthLabel: { fontFamily: fonts.display.bold, fontSize: 17, color: palette.ink900 },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.body.extra,
    fontSize: 11,
    color: palette.ink400,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: space[3] },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellPressed: { opacity: 0.6 },
  dayDot: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: colors.brand },
  dayText: { fontFamily: fonts.body.bold, fontSize: 15, color: palette.ink900 },
  dayTextSelected: { color: colors.textOnBrand },
  dayToday: { color: colors.brand },
});
