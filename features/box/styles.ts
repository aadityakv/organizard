// Styles shared by two or more files in this feature. Anything used by a single
// component lives next to that component.
import { StyleSheet } from 'react-native';

import { fonts, palette, radius } from '@/theme';

export const shared = StyleSheet.create({
  pressed: { opacity: 0.7 },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: { fontFamily: fonts.display.bold, fontSize: 16, color: palette.ink900 },

  sheetBlurb: {
    fontFamily: fonts.body.semibold,
    fontSize: 13.5,
    color: palette.ink500,
    lineHeight: 19,
    marginBottom: 14,
  },
  fieldLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 13,
    color: palette.ink700,
    marginTop: 16,
    marginBottom: 8,
  },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  flex1: { flex: 1 },
  doneButton: { marginTop: 16 },
  dashed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: palette.sand400,
    borderRadius: radius.md,
  },
  dashedText: { fontFamily: fonts.body.bold, fontSize: 15, color: palette.green700 },
});
