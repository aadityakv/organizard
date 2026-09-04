// Store subscriptions and derived data for the dashboard. Selectors that build a
// fresh object (moveProgress, moveTotals) go through useShallow.
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { Box } from '@/data/types';
import { PERM } from '@/lib/permissions';
import { currentRole, moveProgress, moveTotals, useStore } from '@/store/useStore';

import { STATUS_ORDER, type GroupView } from './constants';

/** Store subscriptions, progress and the box ordering for the chosen dashboard view. */
export function useDashboard(view: GroupView) {
  const role = useStore(currentRole);
  const move = useStore((s) => s.move);
  const rooms = useStore((s) => s.rooms);
  const boxes = useStore((s) => s.boxes);
  const progress = useStore(useShallow(moveProgress));
  const totals = useStore(useShallow(moveTotals));

  const canEdit = PERM.canEdit(role);
  const pct = progress.total > 0 ? Math.round((progress.sealed / progress.total) * 100) : 0;

  // Boxes sorted for the Status / Value views.
  const sortedBoxes = useMemo<Box[]>(() => {
    const next = [...boxes];
    if (view === 'value') {
      // Value is computed from items; sort by live value, descending.
      return next; // sort handled by <ValueSortedGrid> with stats injected via render
    }
    next.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
    return next;
  }, [boxes, view]);

  return { move, rooms, boxes, progress, totals, canEdit, pct, sortedBoxes };
}
