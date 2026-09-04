// Which box the next captures go into.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, Sheet } from '@/components';
import { boxColor, colors, fonts, palette } from '@/theme';

import type { BoxRef, StreamView } from './types';

type Props = {
  visible: boolean;
  view: StreamView;
  boxes: BoxRef[];
  selectedId: string;
  onSelect: (boxId: string) => void;
  onClose: () => void;
};

/** Sheet to choose which box the session is capturing into. */
export function BoxPickerSheet({ visible, view, boxes, selectedId, onSelect, onClose }: Props) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={view === 'capture' ? 'Capture into which box?' : 'Stream into which box?'}
    >
      <View style={{ gap: 6 }}>
        {boxes.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => onSelect(b.id)}
            style={[styles.pickRow, b.id === selectedId && { backgroundColor: palette.green50 }]}
          >
            <View style={[styles.pickRail, { backgroundColor: boxColor(b.color) }]} />
            <Text style={styles.pickLabel}>
              #{b.number} {b.name}
            </Text>
            {b.id === selectedId ? <Icon name="check" size={18} color={colors.success} /> : null}
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: palette.cream100,
    minHeight: 48,
  },
  pickRail: { width: 14, height: 32, borderRadius: 7 },
  pickLabel: { flex: 1, fontFamily: fonts.body.extra, fontSize: 14.5, color: palette.ink900 },
});
