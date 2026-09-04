// "This session": every captured item, newest first; tap a row to fix it.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Icon, Sheet } from '@/components';
import { money } from '@/lib/money';
import { boxColor, boxTint, fonts, palette } from '@/theme';

import { sharedStyles } from './styles';
import type { SItem } from './types';
import { countOf } from '@/lib/text';

type Props = {
  visible: boolean;
  session: SItem[];
  sessionValue: number;
  fixCount: number;
  colorOf: (boxId: string) => string;
  onEdit: (itemId: string) => void;
  onClose: () => void;
};

/** Sheet listing everything captured this session, with tap-to-fix. */
export function LedgerSheet({ visible, session, sessionValue, fixCount, colorOf, onEdit, onClose }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} title="This session">
      <Text style={styles.ledgerTotals}>
        {countOf(session.length, 'item')} · {money(sessionValue)}
        {fixCount ? ` · ${fixCount} to fix` : ''}
      </Text>
      <ScrollView style={{ maxHeight: 320 }}>
        {session.length === 0 ? <Text style={styles.empty}>Nothing yet — snap your first item.</Text> : null}
        {[...session].reverse().map((it) => (
          <Pressable
            key={it.id}
            onPress={() => onEdit(it.id)}
            style={[styles.ledgerRow, it.needsFix && { backgroundColor: palette.amber50 }]}
          >
            <View style={[sharedStyles.itemIcon, { backgroundColor: boxTint(colorOf(it.boxId)) }]}>
              <Icon name={it.icon} size={19} color={boxColor(colorOf(it.boxId))} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[styles.ledgerName, it.needsFix && { color: palette.amber600 }]}>
                {it.name}
              </Text>
              {it.needsFix ? (
                <Text style={styles.ledgerFix}>That doesn&apos;t look right — tap to fix</Text>
              ) : null}
            </View>
            {it.qty && it.qty > 1 ? <Text style={sharedStyles.qtyChip}>×{it.qty}</Text> : null}
            {it.value != null ? <Text style={sharedStyles.valChip}>{money(it.value)}</Text> : null}
            <Icon name="pencil" size={16} color={palette.ink400} />
          </Pressable>
        ))}
      </ScrollView>
      <Button fullWidth onPress={onClose} style={{ marginTop: 12 }}>
        Back to camera
      </Button>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  ledgerTotals: { fontFamily: fonts.body.extra, fontSize: 12.5, color: palette.ink400, marginBottom: 8 },
  empty: {
    paddingVertical: 24,
    textAlign: 'center',
    color: palette.ink400,
    fontFamily: fonts.body.bold,
    fontSize: 13.5,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 8,
    borderRadius: 12,
    marginBottom: 2,
  },
  ledgerName: { fontFamily: fonts.body.extra, fontSize: 14, color: palette.ink900 },
  ledgerFix: { fontSize: 11.5, fontFamily: fonts.body.bold, color: palette.amber600 },
});
