// Capture entry (the nav center button) → Streaming Mode. Free users see the Pro
// upsell here; Pro users pick a box and drop straight into the stream session.
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Header, Icon } from '@/components';
import { isProNow, useStore } from '@/store/useStore';
import { boxColor, fonts, palette, radius } from '@/theme';

const PERKS: { icon: string; label: string }[] = [
  { icon: 'camera', label: 'Snap a photo and just say what it is' },
  { icon: 'mic', label: 'Or turn photos off and talk a whole box in' },
  { icon: 'badge-check', label: 'Value & quantity parsed from your voice' },
];

export default function Capture() {
  const boxes = useStore((s) => s.boxes);
  const isPro = useStore(isProNow);
  const startProTrial = useStore((s) => s.startProTrial);

  if (!isPro) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Stream items" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.upsell}>
          <View style={styles.tile}><Icon name="zap" size={28} color={palette.green700} /></View>
          <Text style={styles.upTitle}>Pack 10× faster with Stream</Text>
          <Text style={styles.upSub}>Snap or speak item after item — Tuck fills in the name, count and value as you go. Part of Tuck Pro.</Text>
          <View style={styles.perks}>
            {PERKS.map((p) => (
              <View key={p.icon} style={styles.perkRow}>
                <View style={styles.perkIcon}><Icon name={p.icon} size={16} color={palette.green700} /></View>
                <Text style={styles.perkText}>{p.label}</Text>
              </View>
            ))}
          </View>
          <Button fullWidth size="lg" onPress={() => startProTrial()}>Try Pro free for 7 days</Button>
          <Button variant="ghost" fullWidth onPress={() => router.back()} style={{ marginTop: 4 }}>Maybe later</Button>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Stream items" subtitle="Which box are you packing?" onBack={() => router.back()} />
      {boxes.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="package" size={32} color={palette.ink400} />
          <Text style={styles.emptyText}>No boxes yet — add a box first, then stream into it.</Text>
          <Button onPress={() => router.back()}>Back</Button>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {boxes.map((b) => (
            <Pressable key={b.id} onPress={() => router.replace(`/stream/${b.id}`)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
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
  upsell: { padding: 24, alignItems: 'center', gap: 10 },
  tile: { width: 56, height: 56, borderRadius: 16, backgroundColor: palette.green50, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  upTitle: { fontFamily: fonts.display.bold, fontSize: 23, color: palette.ink900, textAlign: 'center' },
  upSub: { fontSize: 14, fontFamily: fonts.body.bold, color: palette.ink500, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  perks: { gap: 10, marginVertical: 14, alignSelf: 'stretch' },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  perkIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: palette.green50, alignItems: 'center', justifyContent: 'center' },
  perkText: { fontSize: 13.5, fontFamily: fonts.body.bold, color: palette.ink700, flex: 1 },
});
