// Join paste sheet — routes a pasted invite link or code to /invite.
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button, Input, Sheet } from '@/components';
import { fonts, palette } from '@/theme';

/** Sheet to paste an invite link and join a shared move. */
export function JoinSheet({
  visible,
  onClose,
  value,
  onChange,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  value: string;
  onChange: (t: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Join a move">
      <Text style={styles.sheetBody}>Paste the invite link or code a friend shared with you.</Text>
      <Input value={value} onChangeText={onChange} placeholder="Paste invite link or code" autoFocus />
      <Button fullWidth iconLeft="link" onPress={onSubmit} disabled={!value.trim()} style={styles.sheetCta}>
        Join
      </Button>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheetBody: {
    fontFamily: fonts.body.semibold,
    fontSize: 14,
    color: palette.ink500,
    lineHeight: 20,
    marginBottom: 14,
  },
  sheetCta: { marginTop: 16 },
});
