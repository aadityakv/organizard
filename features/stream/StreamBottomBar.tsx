// Stream bottom controls: the session strip (tap for the ledger), the big button
// (capture / say items / stop), and Redo last.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components';
import { boxColor, boxTint, fonts, palette } from '@/theme';

import { sharedStyles } from './styles';
import type { Mic, SItem } from './types';
import { MIC } from './types';

type Props = {
  session: SItem[];
  mic: Mic;
  voiceMode: boolean;
  resayActive: boolean;
  colorOf: (boxId: string) => string;
  onOpenLedger: () => void;
  onCapture: () => void;
  onResay: () => void;
};

/** Bottom bar for the session: ledger, the big capture button, resay and finish. */
export function StreamBottomBar({
  session,
  mic,
  voiceMode,
  resayActive,
  colorOf,
  onOpenLedger,
  onCapture,
  onResay,
}: Props) {
  const listening = mic === MIC.listening;
  return (
    <View style={styles.bottom}>
      <View style={styles.bottomSide}>
        <Pressable onPress={onOpenLedger} style={styles.strip} accessibilityLabel="Session items">
          {session.slice(-2).map((it, i) => (
            <View
              key={it.id}
              style={[
                styles.thumb,
                { backgroundColor: boxTint(colorOf(it.boxId)), marginLeft: i === 0 ? 0 : -16 },
              ]}
            >
              <Icon name={it.icon} size={20} color={boxColor(colorOf(it.boxId))} />
            </View>
          ))}
          <Text style={[styles.countPill, session.length ? { marginLeft: 18 } : null]}>{session.length}</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={onCapture}
        style={[sharedStyles.shutter, listening && styles.shutterStop]}
        accessibilityLabel={listening ? 'Stop' : voiceMode ? 'Say items' : 'Capture'}
      >
        <Icon
          name={listening ? 'square' : voiceMode ? 'mic' : 'camera'}
          size={listening ? 26 : voiceMode ? 32 : 30}
          color="#fff"
        />
      </Pressable>
      <View style={[styles.bottomSide, { alignItems: 'flex-end' }]}>
        <Pressable onPress={onResay} style={styles.redo} accessibilityLabel="Redo last">
          <Icon name="rotate-ccw" size={20} color={resayActive ? '#fff' : 'rgba(255,255,255,0.4)'} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  bottomSide: { flex: 1 },
  strip: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    color: '#fff',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontSize: 12,
    fontFamily: fonts.body.extra,
    overflow: 'hidden',
  },
  shutterStop: { backgroundColor: palette.red500, borderColor: 'rgba(255,255,255,0.85)' },
  redo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
