// Organizard — typography
// Display: Fredoka (rounded, warm). Body / UI: Nunito.
// Font-family strings match the @expo-google-fonts module names
// loaded in app/_layout.tsx.
import type { TextStyle } from 'react-native';

/** Loaded font-family identifiers (see app/_layout.tsx useFonts map). */
export const fonts = {
  display: {
    regular: 'Fredoka_400Regular',
    medium: 'Fredoka_500Medium',
    semibold: 'Fredoka_600SemiBold',
    bold: 'Fredoka_700Bold',
  },
  body: {
    regular: 'Nunito_400Regular',
    semibold: 'Nunito_600SemiBold',
    bold: 'Nunito_700Bold',
    extra: 'Nunito_800ExtraBold',
  },
} as const;

/** Size scale (px). Body default 15, never below 11. */
export const fontSize = {
  '2xs': 11,
  xs: 12,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 30,
  '3xl': 38,
  display: 46,
} as const;

/** Semantic type roles as spreadable TextStyle objects. */
export const type = {
  /** Hero value numbers, big brand moments. */
  display: { fontFamily: fonts.display.bold, fontSize: fontSize.display, lineHeight: 50 } as TextStyle,
  /** Large screen titles. */
  title: { fontFamily: fonts.display.semibold, fontSize: fontSize['2xl'], lineHeight: 34 } as TextStyle,
  /** Standard screen header title (matches the design Header). */
  screenTitle: {
    fontFamily: fonts.display.bold,
    fontSize: 22,
    lineHeight: 26,
    color: '#2A2722',
  } as TextStyle,
  /** Section headers. */
  heading: { fontFamily: fonts.display.semibold, fontSize: fontSize.lg, lineHeight: 24 } as TextStyle,
  /** Card / list-item titles. */
  cardTitle: { fontFamily: fonts.display.semibold, fontSize: fontSize.md, lineHeight: 20 } as TextStyle,
  /** Default body text. */
  body: { fontFamily: fonts.body.regular, fontSize: fontSize.base, lineHeight: 22 } as TextStyle,
  /** Bold body (emphasis). */
  bodyBold: { fontFamily: fonts.body.bold, fontSize: fontSize.base, lineHeight: 22 } as TextStyle,
  /** Buttons, chips, UI affordances. */
  label: { fontFamily: fonts.body.bold, fontSize: fontSize.base } as TextStyle,
  /** Meta, secondary. */
  caption: { fontFamily: fonts.body.semibold, fontSize: fontSize.sm } as TextStyle,
  /** Tiny all-caps eyebrow labels. */
  eyebrow: {
    fontFamily: fonts.body.extra,
    fontSize: fontSize['2xs'],
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  } as TextStyle,
  /** Big value numerals (Fredoka, tabular feel). */
  numeral: { fontFamily: fonts.display.bold, fontSize: fontSize['2xl'] } as TextStyle,
} as const;
