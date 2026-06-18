// Capture entry (the nav center button). The capture screen itself is the unified
// dark-camera screen at /stream/[boxId], where the one control — One item · Snap many ·
// Say a box — lives. This verb just resolves a box to capture into (the most recent),
// or prompts to add one first when the library is empty.
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Header, Icon } from '@/components';
import { useStore } from '@/store/useStore';
import { fonts, palette } from '@/theme';

export default function Capture() {
  const boxes = useStore((s) => s.boxes);
  const target = boxes[boxes.length - 1]?.id; // most recently added box

  useEffect(() => {
    if (target) router.replace(`/stream/${target}`);
  }, [target]);

  // Brief dark hold while forwarding into the (dark) capture screen.
  if (target) return <View style={styles.hold} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Capture" onBack={() => router.back()} />
      <View style={styles.empty}>
        <Icon name="package" size={32} color={palette.ink400} />
        <Text style={styles.emptyText}>No boxes yet — add a box first, then capture into it.</Text>
        <Button onPress={() => router.back()}>Back</Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.cream100 },
  hold: { flex: 1, backgroundColor: '#161817' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 },
  emptyText: { fontFamily: fonts.body.semibold, fontSize: 14, color: palette.ink500, textAlign: 'center', lineHeight: 20 },
});
