// Store subscriptions for the moves library, split into active / archived rows.
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { moveSummaries, useStore } from '@/store/useStore';

/** Move summaries for the library screen, derived from stable store slices. */
export function useMoveLibrary() {
  // moveSummaries builds a fresh array of fresh objects every call, so feeding it to
  // useShallow infinite-loops (useShallow's one-level compare can't stabilize nested
  // objects → "Maximum update depth exceeded", which crashes on React 19). Instead,
  // subscribe to the stable inputs it derives from and compute it once via useMemo.
  const library = useStore((s) => s.library);
  const currentMoveId = useStore((s) => s.currentMoveId);
  const account = useStore((s) => s.account);
  const liveSlice = useStore(
    useShallow((s) => ({
      move: s.move,
      boxes: s.boxes,
      itemsByBox: s.itemsByBox,
      members: s.members,
      activeMode: s.activeMode,
    })),
  );
  const summaries = useMemo(
    () => moveSummaries({ library, currentMoveId, account, ...liveSlice }),
    [library, currentMoveId, account, liveSlice],
  );

  const active = summaries.filter((s) => !s.archived);
  const archived = summaries.filter((s) => s.archived);

  return { summaries, active, archived, account, currentMoveId };
}
