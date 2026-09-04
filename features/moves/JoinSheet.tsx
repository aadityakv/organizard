// Join paste sheet — routes a pasted invite link or code to /invite.
import { StyleSheet, Text } from 'react-native';

import { Button, Input, Sheet } from '@/components';
import { fonts, palette } from '@/theme';
import { copy } from '@/copy/moves';

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
    <Sheet visible={visible} onClose={onClose} title={copy.joinAMove}>
      <Text style={styles.sheetBody}>{copy.pasteTheInviteLinkOr}</Text>
      <Input value={value} onChangeText={onChange} placeholder={copy.pasteInviteLinkOrCode} autoFocus />
      <Button fullWidth iconLeft="link" onPress={onSubmit} disabled={!value.trim()} style={styles.sheetCta}>
        {copy.join}
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
