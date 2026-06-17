// Capture entry (the nav center button). Free single-item capture: ask which box,
// then open Add item. Streaming stays the Pro accelerator on box detail — the nav
// itself is never paywalled.
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Header, Icon } from '@/components';
import { useStore } from '@/store/useStore';
import { boxColor, fonts, palette, radius } from '@/theme';

export default function Capture() {
  const boxes = useStore((s) => s.boxes);
  const pick = (boxId: string) => router.replace({ pathname: '/add-item', params: { boxId } });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Add an item" subtitle="Which box are you packing?" onBack={() => router.back()} />
      {boxes.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="package" size={32} color={palette.ink400} />
          <Text style={styles.emptyText}>No boxes yet — add a box first, then capture into it.</Text>
          <Button onPress={() => router.back()}>Back</Button>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {boxes.map((b) => (
            <Pressable key={b.id} onPress={() => pick(b.id)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <View style={[styles.rail, { backgroundColor: boxColor(b.color) }]} />
              <Text style={styles.label} numberOfLines={1}>#{b.number} {b.name}</Text>
              <Icon name="chevron-right" size={18} color={palette.ink400} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.cream100 },
  list: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.white, borderRadius: radius.lg, padding: 14, minHeight: 56 },
  rowPressed: { backgroundColor: palette.cream200 },
  rail: { width: 14, height: 34, borderRadius: 7 },
  label: { flex: 1, fontFamily: fonts.body.extra, fontSize: 15, color: palette.ink900 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 },
  emptyText: { fontFamily: fonts.body.semibold, fontSize: 14, color: palette.ink500, textAlign: 'center', lineHeight: 20 },
});
