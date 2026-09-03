// Styles used by more than one piece of the stream screen.
import { StyleSheet } from 'react-native';

import { colors, fonts, palette } from '@/theme';

export const sharedStyles = StyleSheet.create({
  /** The big round capture button (capture view and stream bottom bar). */
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Item glyph tile (last-captured card and ledger rows). */
  itemIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qtyChip: {
    backgroundColor: palette.cream200,
    color: palette.ink700,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 9,
    fontSize: 11.5,
    fontFamily: fonts.body.extra,
    overflow: 'hidden',
  },
  valChip: {
    backgroundColor: palette.amber50,
    color: palette.amber600,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 9,
    fontSize: 11.5,
    fontFamily: fonts.body.extra,
    overflow: 'hidden',
  },
});
