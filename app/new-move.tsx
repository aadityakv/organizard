// Create-move modal — name (required) + optional from / to / target date.
// Creating switches the store into the new move and lands on the dashboard.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Button, Card, Header, Input } from '@/components';
import { useStore } from '@/store/useStore';
import { colors } from '@/theme';

export default function NewMove() {
  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [target, setTarget] = useState('');

  const onCreate = () => {
    useStore.getState().createMove({
      name: name.trim(),
      from: from.trim(),
      to: to.trim(),
      target: target.trim(),
    });
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="New move" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Apartment move" autoFocus />
          <View style={styles.gap} />
          <Input label="From (optional)" value={from} onChangeText={setFrom} placeholder="e.g. Brooklyn" />
          <View style={styles.gap} />
          <Input label="To (optional)" value={to} onChangeText={setTo} placeholder="e.g. Austin" />
          <View style={styles.gap} />
          <Input label="Target date (optional)" value={target} onChangeText={setTarget} placeholder="e.g. Jul 12" />
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
