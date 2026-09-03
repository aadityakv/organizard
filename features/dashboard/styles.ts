// Styles shared by two or more dashboard pieces. Anything used by a single
// component lives next to that component.
import { StyleSheet } from 'react-native';

import { colors, fonts, fontSize, palette, radius, shadow } from '@/theme';

const GRID_GAP = 14;

export const shared = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridCard: {
    width: `48%`,
  },

  pressedSoft: { opacity: 0.7 },
});

/** Form chrome shared by the Add-box and Room sheets. */
export const sheetForm = StyleSheet.create({
  fieldLabel: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: palette.ink700,
    marginTop: 16,
    marginBottom: 8,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    marginTop: 24,
    ...shadow.brand,
  },
  ctaDisabled: {
    opacity: 0.45,
    backgroundColor: palette.sand400,
  },
  ctaPressed: {
    backgroundColor: colors.brandPressed,
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.md,
    color: colors.textOnBrand,
  },
});
