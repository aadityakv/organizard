// Pro upsell sheet for Streaming Mode, shown when a free user taps a Stream entry.
// "Try Pro" starts the local trial; real billing replaces that later.
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { fonts, palette } from '@/theme';
import { copy } from '@/copy/shared';

const PERKS: { icon: string; label: string }[] = [
  { icon: 'camera', label: 'Snap a photo and just say what it is' },
  { icon: 'mic', label: 'Or turn photos off and talk a whole box in' },
  { icon: 'badge-check', label: 'Value & quantity parsed from your voice' },
];

/** Pro upsell sheet for Streaming Mode with a start-trial action. */
export function StreamUpsell({
  visible,
  onClose,
  onTryPro,
}: {
  visible: boolean;
  onClose: () => void;
  onTryPro: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.head}>
        <View style={styles.tile}>
          <Icon name="zap" size={28} color={palette.green700} />
        </View>
        <Text style={styles.title}>{copy.upsellTitle}</Text>
        <Text style={styles.sub}>{copy.snapOrSpeakItemAfter}</Text>
      </View>
      <View style={styles.perks}>
        {PERKS.map((p) => (
          <View key={p.icon} style={styles.perkRow}>
            <View style={styles.perkIcon}>
              <Icon name={p.icon} size={16} color={palette.green700} />
            </View>
            <Text style={styles.perkText}>{p.label}</Text>
          </View>
        ))}
      </View>
      <Button fullWidth size="lg" onPress={onTryPro}>
        {copy.upsellButton}
      </Button>
      <Button variant="ghost" fullWidth onPress={onClose} style={{ marginTop: 4 }}>
        Maybe later
      </Button>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', marginBottom: 18 },
  tile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: palette.green50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontFamily: fonts.display.bold, fontSize: 23, color: palette.ink900, textAlign: 'center' },
  sub: {
    fontSize: 14,
    fontFamily: fonts.body.bold,
    color: palette.ink500,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 300,
  },
  perks: { gap: 10, marginBottom: 18 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  perkIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.green50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkText: { fontSize: 13.5, fontFamily: fonts.body.bold, color: palette.ink700, flex: 1 },
});
