// iOS-only keyboard accessory: a Done button above the keyboard so the notes /
// value keyboard can be dismissed to reach Save.
import React from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, fontSize, gutter, palette, space } from '@/theme';

import { KBD_ACCESSORY_ID } from './constants';

export function KeyboardDoneBar() {
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={KBD_ACCESSORY_ID}>
      <View style={styles.kbdBar}>
        <Pressable
          onPress={() => Keyboard.dismiss()}
          accessibilityRole="button"
          accessibilityLabel="Done"
          hitSlop={8}
          style={({ pressed }) => [styles.kbdDone, pressed && styles.kbdDonePressed]}
        >
          <Text style={styles.kbdDoneText}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  kbdBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: palette.cream100,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.sand300,
    paddingHorizontal: gutter,
    paddingVertical: space[1] + 2,
  },
  kbdDone: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  kbdDonePressed: { opacity: 0.6 },
  kbdDoneText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.base,
    color: colors.brand,
  },
});
