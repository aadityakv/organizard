// The feedback pill under the viewfinder: live transcript while listening, "Got it"
// after a capture, or "didn't catch a name" (tap to type it).
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components';
import { colors, fonts, palette, alpha } from '@/theme';

import type { Mic, SItem } from './types';
import { MIC } from './types';

type Props = {
  mic: Mic;
  transcript: string;
  lastBatch: number;
  lastIt: SItem | null;
  onFixLast: () => void;
};

/** Mic state pills: ready, listening with live transcript, got it, or fix-last. */
export function MicPills({ mic, transcript, lastBatch, lastIt, onFixLast }: Props) {
  return (
    <View style={styles.pillRow}>
      {mic === MIC.listening ? (
        <View style={styles.pillListening}>
          <View style={styles.wave}>
            {[14, 9, 15, 11].map((h, i) => (
              <View key={i} style={[styles.waveBar, { height: h }]} />
            ))}
          </View>
          <Text style={styles.pillListenText} numberOfLines={1}>
            {'“' + (transcript || '…') + '”'}
          </Text>
        </View>
      ) : null}
      {mic === MIC.gotIt && (lastBatch > 1 || (lastIt && !lastIt.needsFix)) ? (
        <View style={styles.pillGot}>
          <Icon name="check" size={16} color={palette.green700} />
          <Text style={styles.pillGotText}>
            {lastBatch > 1 ? `Added ${lastBatch} items` : `Got it — ${lastIt?.name}`}
          </Text>
        </View>
      ) : null}
      {mic === MIC.fail ? (
        <Pressable onPress={onFixLast} style={styles.pillFail}>
          <Icon name="ear" size={16} color={palette.amber600} />
          <Text style={styles.pillFailText}>Hmm — didn&apos;t catch a name. Tap to type it.</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pillRow: {
    alignItems: 'center',
    marginTop: 26,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  pillListening: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    maxWidth: '100%',
  },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 2.5, height: 16 },
  waveBar: { width: 3, borderRadius: 999, backgroundColor: alpha(palette.white, 0.95) },
  pillListenText: { color: palette.white, fontFamily: fonts.body.bold, fontSize: 14, flexShrink: 1 },
  pillGot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.green50,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  pillGotText: { color: palette.green700, fontFamily: fonts.body.extra, fontSize: 14 },
  pillFail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.amber50,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  pillFailText: { color: palette.amber600, fontFamily: fonts.body.extra, fontSize: 13 },
});
