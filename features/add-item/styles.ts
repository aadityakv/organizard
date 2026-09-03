// Styles shared by more than one section of the Add item form.
import { StyleSheet } from 'react-native';

import { colors, fonts, fontSize, space } from '@/theme';

export const sharedStyles = StyleSheet.create({
  // Section headings (Photos / Markers / Move to box)
  sectionHeading: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: colors.textBody,
  },
  // A heading plus a wrapping row of chips (markers, move-to-box)
  chipSection: {
    gap: space[2],
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
});
