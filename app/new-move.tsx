// Create-move modal — name (required) + optional from / to / target date.
// From/To use platform-native address autocomplete (Apple Maps on iOS); the
// target date uses the native date picker. Creating switches the store into the
// new move and lands on the dashboard.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { AddressField, Button, Card, DateField, formatTargetDate, Header, Input } from '@/components';
import { shareMove } from '@/services/share';
import { useStore } from '@/store/useStore';
import { colors } from '@/theme';

export default function NewMove() {
  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [targetDate, setTargetDate] = useState<Date | null>(null);

  const onCreate = () => {
    useStore.getState().createMove({
      name: name.trim(),
      from: from.trim(),
      to: to.trim(),
      target: targetDate ? formatTargetDate(targetDate) : '',
    });
    // Synced by default: a signed-in user's new move is pushed to the server right away
    // (offline → it stays local and is migrated up on the next sign-in / sync).
    if (useStore.getState().session) {
      void shareMove().catch((e) => console.warn('new move: server sync failed (stays local)', e));
    }
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="New move" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Input
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Apartment move"
            autoFocus
          />
          <View style={styles.gap} />
          <AddressField
            label="From (optional)"
            value={from}
            onChangeText={setFrom}
            placeholder="Search an address"
          />
          <View style={styles.gap} />
          <AddressField
            label="To (optional)"
            value={to}
            onChangeText={setTo}
            placeholder="Search an address"
          />
          <View style={styles.gap} />
          <DateField
            label="Target date (optional)"
            value={targetDate}
            onChange={setTargetDate}
            placeholder="Pick a date"
          />
          <Button fullWidth iconLeft="plus" onPress={onCreate} disabled={!name.trim()} style={styles.cta}>
            Create move
          </Button>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceApp },
  content: { paddingHorizontal: 16, paddingBottom: 60 },
  card: { padding: 18 },
  gap: { height: 14 },
  cta: { marginTop: 22 },
});
