// In-box item controls: sort mode + a toggleable search field, scoped to ONE box.
// Display-only — the stored item array is never mutated.
import { useMemo, useState } from 'react';

import type { Item, Marker } from '@/data/types';

// "Added" keeps the stored insertion order (today's default); the others are
// display-only re-orderings derived with useMemo.
export type SortMode = 'added' | 'recent' | 'az' | 'value';

export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'added', label: 'Added' },
  { value: 'recent', label: 'Recent' },
  { value: 'az', label: 'A–Z' },
  { value: 'value', label: 'Value' },
];

/** Search and sort state for a box's items, returning the list to render. */
export function useVisibleItems(items: Item[], allMarkers: Marker[]) {
  const [sortMode, setSortMode] = useState<SortMode>('added');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  // Opening the search shows the field; closing it also clears the query.
  const toggleSearching = () =>
    setSearching((prev) => {
      if (prev) setQuery('');
      return !prev;
    });

  const visibleItems = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter(
          (it) =>
            it.name.toLowerCase().includes(q) ||
            (it.markers ?? []).some((mid) =>
              (allMarkers.find((m) => m.id === mid)?.label.toLowerCase() ?? '').includes(q),
            ),
        )
      : items;

    if (sortMode === 'added') return filtered;
    const next = [...filtered];
    if (sortMode === 'recent') return next.reverse();
    if (sortMode === 'az')
      return next.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    // 'value' — by the item's displayed value, high → low.
    return next.sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [items, query, sortMode, allMarkers]);

  return { sortMode, setSortMode, searching, toggleSearching, query, setQuery, visibleItems };
}
