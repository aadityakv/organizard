// Segmented: a pill-shaped control for two to four mutually exclusive options
// (dashboard grouping, item sort, member role, sign-in vs register). Controlled via
// `value` / `onChange`; the selected segment is raised on a white card.
import React from 'react';
import { View, Text, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, palette, radius, shadow, space, fonts, fontSize } from '@/theme';

export type SegmentedProps = {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};

/** Segmented control for a small set of mutually exclusive options. */
export function Segmented({ options, value, onChange, size = 'md', style }: SegmentedProps) {
  const segmentHeight = size === 'sm' ? 32 : 38;
  const labelSize = size === 'sm' ? fontSize.sm : 14;

  return (
    <View style={[styles.track, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              { height: segmentHeight, minHeight: 44 },
              active && styles.segmentActive,
              pressed && styles.segmentPressed,
            ]}
          >
            <Text
              style={[
                styles.label,
                { fontSize: labelSize },
                active ? styles.labelActive : styles.labelInactive,
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.cream200,
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
    alignSelf: 'flex-start',
  },
  segment: {
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    // Ensure tap target is at least 44px tall via minHeight
  },
  segmentActive: {
    backgroundColor: palette.white,
    ...shadow.sm,
  },
  segmentPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  label: {
    fontFamily: fonts.body.bold,
    // fontSize applied inline from size prop
  },
  labelActive: {
    color: colors.textStrong,
  },
  labelInactive: {
    color: colors.textMuted,
  },
});
