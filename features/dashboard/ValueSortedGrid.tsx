// Value view needs live per-box value, which lives in the store; resolve it
// here, then sort descending.
import React, { useMemo } from 'react';
import { View } from 'react-native';

import type { Box } from '@/data/types';
import { useStore } from '@/store/useStore';

import { DashboardBoxCard } from './DashboardBoxCard';
import { shared } from './styles';

/** Box grid ordered by estimated value, highest first. */
export function ValueSortedGrid({ boxes }: { boxes: Box[] }) {
  const itemsByBox = useStore((s) => s.itemsByBox);
  const sorted = useMemo<Box[]>(() => {
    const valueOf = (b: Box): number =>
      (itemsByBox[b.id] ?? []).reduce((sum, it) => sum + (it.value || 0), 0);
    return [...boxes].sort((a, b) => valueOf(b) - valueOf(a));
  }, [boxes, itemsByBox]);

  return (
    <View style={shared.grid}>
      {sorted.map((b) => (
        <DashboardBoxCard key={b.id} box={b} />
      ))}
    </View>
  );
}
