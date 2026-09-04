// Dashboard tile for a box: color rail, cover or tint band, name, room, status and markers.
import React, { useState } from 'react';
import { Animated, Image, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import {
  boxColor,
  boxTint,
  colors,
  fonts,
  fontSize,
  radius,
  shadow,
  space,
  type as typeTokens,
} from '@/theme';
import { money } from '@/lib/money';
import { StatusChip } from '@/components/StatusChip';

export type BoxCardProps = {
  name: string;
  number?: number;
  color: string;
  room?: string;
  itemCount?: number;
  value?: number;
  statusLabel: string;
  statusColor: string;
  markers?: { label: string; color: string; icon: string }[];
  cover?: string | null;
  /** Auth headers for a remote cover photo source. */
  coverHeaders?: Record<string, string>;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

// MarkerChip inline (tiny pill, no onPress needed here — display-only)
// The full MarkerChip with toggle affordance lives in MarkerChip.tsx.
type MarkerPill = { label: string; color: string; icon: string };

function InlineMarker({ label, color: hue }: MarkerPill) {
  return (
    <View style={[markerStyles.pill, { backgroundColor: boxTint(hue) }]}>
      <View style={[markerStyles.dot, { backgroundColor: boxColor(hue) }]} />
      <Text style={markerStyles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const markerStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  label: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize['2xs'],
    color: colors.textStrong,
    includeFontPadding: false,
  },
});

/** Grid card for a box: color rail, cover or tint band, name, room, status and marker chips. */
export function BoxCard({
  name,
  number,
  color,
  room,
  itemCount = 0,
  value = 0,
  statusLabel,
  statusColor,
  markers = [],
  cover = null,
  coverHeaders,
  onPress,
  style,
}: BoxCardProps) {
  const [scaleAnim] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.985,
      duration: 80,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  const solid = boxColor(color);
  const tint = boxTint(color);
  const visibleMarkers = markers.slice(0, 3);

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`Box ${number != null ? `#${number} ` : ''}${name}`}
        style={styles.card}
      >
        <View style={[styles.rail, { backgroundColor: solid }]} />

        <View style={[styles.band, { backgroundColor: tint }]}>
          {cover ? (
            <Image
              source={{ uri: cover, headers: coverHeaders }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : null}

          {/* scrim over photo so text stays legible */}
          {cover ? <View style={styles.bandScrim} /> : null}

          {number != null ? (
            <View style={[styles.numberBadge, cover ? styles.numberBadgeDark : null]}>
              <Text style={[styles.numberText, { color: cover ? colors.textOnDark : solid }]}>
                {`#${number}`}
              </Text>
            </View>
          ) : (
            /* spacer so StatusChip always goes to the right */
            <View />
          )}

          <StatusChip label={statusLabel} color={statusColor} size="sm" />
        </View>

        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>

          {room ? (
            <Text style={styles.room} numberOfLines={1}>
              {room}
            </Text>
          ) : null}

          <View style={styles.statsRow}>
            <Text style={styles.count}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Text>
            <Text style={styles.value}>{money(value)}</Text>
          </View>

          {visibleMarkers.length > 0 ? (
            <View style={styles.markersRow}>
              {visibleMarkers.map((m, i) => (
                <InlineMarker key={i} {...m} />
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.sm,
  },

  rail: {
    height: 5,
  },

  band: {
    height: 84,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: space[2] + 2,
    overflow: 'hidden',
  },

  bandScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },

  numberBadge: {
    // transparent by default (no cover)
    borderRadius: radius.pill,
    paddingHorizontal: 0,
    paddingVertical: 0,
    // ensure above the scrim
    zIndex: 1,
  },

  numberBadgeDark: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },

  numberText: {
    fontFamily: fonts.display.bold,
    fontSize: fontSize.sm,
    lineHeight: 18,
    includeFontPadding: false,
  },

  body: {
    paddingHorizontal: 14,
    paddingTop: space[3],
    paddingBottom: 14,
    gap: 4,
  },

  name: {
    ...typeTokens.cardTitle,
    color: colors.textStrong,
  },

  room: {
    ...typeTokens.eyebrow,
    color: colors.textMuted,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: space[2],
    gap: space[2],
  },

  count: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    includeFontPadding: false,
  },

  value: {
    fontFamily: fonts.display.bold,
    fontSize: fontSize.md,
    color: colors.success,
    includeFontPadding: false,
  },

  markersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: space[2],
  },
});
