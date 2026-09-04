// Input: the labelled text field used by every form and sheet. Wraps TextInput with an
// eyebrow label, optional prefix (e.g. "$"), multiline mode, and an animated border that
// tints green on focus. Font size is pinned to 16 so iOS does not zoom the page on
// focus. `inputAccessoryViewID` attaches an iOS keyboard bar (see KeyboardDoneBar).
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, StyleProp, ViewStyle, Animated } from 'react-native';
import { colors, radius, space, fonts, fontSize, motion } from '@/theme';

export type InputProps = {
  value: string;
  onChangeText: (t: string) => void;
  label?: string;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'email-address';
  multiline?: boolean;
  prefix?: string;
  autoFocus?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  /** iOS autofill hint (e.g. 'emailAddress', 'password', 'newPassword'). */
  textContentType?: 'none' | 'emailAddress' | 'password' | 'newPassword' | 'username';
  /** iOS: attach a keyboard accessory (e.g. a Done bar) by nativeID. */
  inputAccessoryViewID?: string;
  /** Cap the text length (keeps inputs under the server's field caps). */
  maxLength?: number;
  style?: StyleProp<ViewStyle>;
};

/** Labelled text input with focus ring, optional prefix and multiline support. */
export function Input({
  value,
  onChangeText,
  label,
  placeholder,
  keyboardType = 'default',
  multiline = false,
  prefix,
  autoFocus = false,
  secureTextEntry = false,
  autoCapitalize = 'sentences',
  textContentType,
  inputAccessoryViewID,
  maxLength,
  style,
}: InputProps) {
  const [focused, setFocused] = useState(false);

  const [animBorder] = useState(() => new Animated.Value(0));

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(animBorder, {
      toValue: 1,
      duration: motion.focusMs,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setFocused(false);
    Animated.timing(animBorder, {
      toValue: 0,
      duration: motion.focusMs,
      useNativeDriver: false,
    }).start();
  };

  const borderColorInterp = animBorder.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.borderSubtle, colors.borderFocus],
  });

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Animated.View
        style={[
          styles.field,
          multiline ? styles.fieldMultiline : styles.fieldSingle,
          { borderColor: borderColorInterp },
          focused && styles.fieldFocused,
        ]}
      >
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}

        <TextInput
          style={[
            styles.input,
            multiline ? styles.inputMultiline : styles.inputSingle,
            prefix ? styles.inputWithPrefix : null,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textPlaceholder}
          keyboardType={keyboardType}
          multiline={multiline}
          autoFocus={autoFocus}
          secureTextEntry={secureTextEntry}
          textContentType={textContentType}
          inputAccessoryViewID={inputAccessoryViewID}
          maxLength={maxLength}
          onFocus={handleFocus}
          onBlur={handleBlur}
          // Prevent iOS zoom: ensure font size >= 16 is set via style
          textAlignVertical={multiline ? 'top' : 'center'}
          autoCorrect={false}
          autoCapitalize={autoCapitalize}
          returnKeyType={multiline ? 'default' : 'done'}
          scrollEnabled={multiline}
          numberOfLines={multiline ? 4 : 1}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: space[1] + 2,
  },

  label: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: colors.textBody,
    marginBottom: 6,
  },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle, // overridden by Animated.View borderColor
    borderRadius: radius.md,
    paddingHorizontal: 14,
    gap: space[2],
  },
  fieldSingle: {
    height: 48,
  },
  fieldMultiline: {
    height: 120,
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  fieldFocused: {
    shadowColor: colors.borderFocus,
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },

  prefix: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.md,
    color: colors.textMuted,
    flexShrink: 0,
    lineHeight: 20,
  },

  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.body.semibold,
    fontSize: 16, // 16px — iOS does NOT auto-zoom when font-size >= 16
    color: colors.textStrong,
    padding: 0, // remove default Android padding
    margin: 0,
  },
  inputSingle: {
    height: 48,
  },
  inputMultiline: {
    height: 96,
    textAlignVertical: 'top',
    paddingTop: 2,
  },
  inputWithPrefix: {},
});
