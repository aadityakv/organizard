// The centre of the screen: the corner frame (photo capture) or the voice ring
// (Photos-off), plus the one-line hint under it.
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components';
import { fonts } from '@/theme';

type Props = {
  mode: 'frame' | 'voice';
  hint: string;
  /** Extra line under the hint (e.g. the simulated-dictation note). */
  note?: string | null;
};

/** Viewfinder frame with the mode hint and an optional note. */
export function Viewfinder({ mode, hint, note }: Props) {
  return (
    <View style={styles.viewfinder}>
      {mode === 'frame' ? (
        <View style={styles.frame}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
      ) : (
        <View style={styles.voiceRing}>
          <View style={styles.voiceRingInner} />
          <Icon name="list-music" size={52} color="rgba(255,255,255,0.5)" />
        </View>
      )}
      <Text style={styles.hint}>{hint}</Text>
      {note ? <Text style={styles.simNote}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  viewfinder: { alignItems: 'center', marginTop: 28, gap: 14, paddingHorizontal: 40 },
  frame: { width: 160, height: 160 },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: 'rgba(255,255,255,0.85)' },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 },
  voiceRing: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceRingInner: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    bottom: 18,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  hint: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.body.bold, fontSize: 13, textAlign: 'center' },
  simNote: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: fonts.body.bold,
    fontSize: 11.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
});
