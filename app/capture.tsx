// The nav "Capture" verb resolves a box and opens the capture view of the unified
// capture screen (app/stream/[boxId]) directly. This route only handles the fallbacks:
// a direct /capture deep link (forward to the capture view) and the empty library.
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Button, Icon } from '@/components';
import { useStore } from '@/store/useStore';
import { fonts, palette } from '@/theme';

export default function Capture() {
  const boxes = useStore((s) => s.boxes);
  const target = boxes[boxes.length - 1]?.id; // most recently added box

  useEffect(() => {
    if (target) router.replace(`/stream/${target}?view=capture`);
  }, [target]);

  // Brief dark hold while forwarding into the (dark) capture screen.
  if (target) return <View style={styles.hold} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Button variant="ghost" iconLeft="x" onPress={() => router.back()}>Close</Button>
      </View>
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
  topBar: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 },
  emptyText: { fontFamily: fonts.body.semibold, fontSize: 14, color: palette.ink500, textAlign: 'center', lineHeight: 20 },
});
