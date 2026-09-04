// In-box item controls: sort mode + a toggleable search field, scoped to ONE box.
// Display-only — the stored item array is never mutated.
import { useMemo, useState } from 'react';

import type { Item, Marker } from '@/data/types';

// "Added" keeps the stored insertion order (today's default); the others are
// display-only re-orderings derived with useMemo.
const SORT_MODE = { added: 'added', recent: 'recent', az: 'az', value: 'value' } as const;
export type SortMode = (typeof SORT_MODE)[keyof typeof SORT_MODE];

export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: SORT_MODE.added, label: 'Added' },
  { value: SORT_MODE.recent, label: 'Recent' },
  { value: SORT_MODE.az, label: 'A–Z' },
  { value: SORT_MODE.value, label: 'Value' },
];

/** Search and sort state for a box's items, returning the list to render. */
export function useVisibleItems(items: Item[], allMarkers: Marker[]) {
  const [sortMode, setSortMode] = useState<SortMode>(SORT_MODE.added);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

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

    if (sortMode === SORT_MODE.added) return filtered;
    const next = [...filtered];
    if (sortMode === SORT_MODE.recent) return next.reverse();
    if (sortMode === SORT_MODE.az)
      return next.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return next.sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [items, query, sortMode, allMarkers]);

  return { sortMode, setSortMode, searching, toggleSearching, query, setQuery, visibleItems };
}
