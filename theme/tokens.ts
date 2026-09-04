// Design tokens: warm cream surfaces, a fresh green brand, and the 12-hue box palette
// that colour-codes boxes and rooms throughout the app.

/** A palette color with an alpha channel, as an rgba() string. */
export const alpha = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** Raw palette — warm neutrals, brand green, accents, danger. */
export const palette = {
  cream50: '#FCFBF8',
  cream100: '#F7F6F2',
  cream200: '#EFEDE5',
  sand300: '#E4E1D7',
  sand400: '#CFCABB',
  sand500: '#ABA593',

  ink900: '#2A2722',
  ink700: '#4C473E',
  ink500: '#6F6A5E',
  ink400: '#918B7C',

  white: '#FFFFFF',
  black: '#000000',

  // Camera and photo surfaces (the only dark chrome in the app)
  cameraBg: '#161817',
  cameraCard: '#1B1D1C',
  cameraViewfinder: '#111312',
  cameraInk: '#141615',
  cameraDim: '#0D0F0E',

  green50: '#EAF6EF',
  green100: '#CFEBDB',
  green200: '#A6DCBC',
  green300: '#7ECCA0',
  green400: '#62BC8C',
  green500: '#4CAF7D',
  green600: '#3C9669',
  green700: '#2E7A54',
  green800: '#245F42',

  amber50: '#FDF3E4',
  amber100: '#FAE2C2',
  amber300: '#F4BE72',
  amber400: '#F2A23C',
  amber500: '#E08A22',
  amber600: '#BE6F12',

  blue50: '#EAF1FE',
  blue100: '#CFE0FC',
  blue300: '#8AB0F4',
  blue400: '#5B8DEF',
  blue500: '#3F73DB',
  blue600: '#2E5CBC',

  red50: '#FDECEA',
  red100: '#F9CFC9',
  red400: '#EC6A5E',
  red500: '#E04B3D',
  red600: '#C0392C',
} as const;

const boxPalette = {
  coral: { solid: '#F2746B', tint: '#FCE7E4' },
  amber: { solid: '#F2A23C', tint: '#FBEBD5' },
  gold: { solid: '#E5C046', tint: '#FAF1CF' },
  lime: { solid: '#9BC53D', tint: '#EDF4D6' },
  green: { solid: '#4CAF7D', tint: '#DBF0E5' },
  teal: { solid: '#2EC4B6', tint: '#D2F2EF' },
  sky: { solid: '#5B8DEF', tint: '#E0EAFD' },
  indigo: { solid: '#7C6FE0', tint: '#E6E3FA' },
  orchid: { solid: '#C56FD0', tint: '#F5E2F7' },
  rose: { solid: '#EE7BA8', tint: '#FCE4EE' },
  clay: { solid: '#C2895E', tint: '#F2E5D8' },
  slate: { solid: '#8A94A6', tint: '#E7EAEF' },
} as const;

export type BoxColor = keyof typeof boxPalette;

/** Ordered hue list — for color pickers (statuses, markers, boxes). */
export const BOX_COLORS = Object.keys(boxPalette) as BoxColor[];
/** Press feedback shared by every tappable surface. */
export const motion = {
  pressScale: 0.97,
  pressCardScale: 0.985,
  pressInMs: 100,
  pressOutMs: 120,
  focusMs: 120,
} as const;

/** Brand hue: the default for boxes and anything unset. */
export const DEFAULT_HUE: BoxColor = 'green';
/** Neutral hue: the default for rooms and missing statuses. */
export const NEUTRAL_HUE: BoxColor = 'slate';

/** Solid hue for a box-palette color name. Falls back to green. */
export const boxColor = (name: string): string =>
  boxPalette[name as BoxColor]?.solid ?? boxPalette.green.solid;

/** Soft tint wash for a box-palette color name. Falls back to green tint. */
export const boxTint = (name: string): string => boxPalette[name as BoxColor]?.tint ?? boxPalette.green.tint;

export const colors = {
  surfaceApp: palette.cream100, // app background (warm cream)
  surfaceCard: palette.white, // cards (white, so photos pop)
  surfaceSunken: palette.cream200,
  surfaceInverse: palette.ink900,
  scrim: 'rgba(42, 39, 34, 0.45)',

  textStrong: palette.ink900,
  textBody: palette.ink700,
  textMuted: palette.ink500,
  textPlaceholder: palette.ink400,
  textOnBrand: palette.white,
  textOnDark: palette.cream50,
  textLink: palette.green700,

  borderSubtle: palette.sand300,
  borderStrong: palette.sand400,
  borderFocus: palette.green500,

  brand: palette.green500,
  brandHover: palette.green600,
  brandPressed: palette.green700,
  brandWash: palette.green50,

  success: palette.green600,
  successWash: palette.green50,
  warning: palette.amber500,
  warningWash: palette.amber50,
  danger: palette.red500,
  dangerWash: palette.red50,
  info: palette.blue500,
  infoWash: palette.blue50,
} as const;

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

/** Screen edge padding. */
export const gutter = 16;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14, // inputs, small cards
  lg: 18, // cards
  xl: 24, // sheets, big cards
  '2xl': 32, // modals, hero blocks
  pill: 999, // chips, buttons
} as const;

type Shadow = {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
};

export const shadow: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'brand', Shadow> = {
  xs: {
    shadowColor: '#363026',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sm: {
    shadowColor: '#363026',
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#363026',
    shadowOpacity: 0.09,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  lg: {
    shadowColor: '#363026',
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  xl: {
    shadowColor: '#363026',
    shadowOpacity: 0.16,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 20 },
    elevation: 18,
  },
  // green-tinted glow for primary CTAs
  brand: {
    shadowColor: '#4CAF7D',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
};

export const tap = {
  min: 44, // iOS minimum hit target
  sm: 36,
  md: 44,
  lg: 52,
} as const;
