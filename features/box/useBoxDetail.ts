// Everything the box detail screen reads from the store, resolved into display
// data, plus the actions it dispatches. Selector discipline (see store/selectors.ts):
// fresh-object selectors go through useShallow; fresh arrays are memoised over the
// stable slices they derive from.
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { Marker } from '@/data/types';
import { PERM } from '@/lib/permissions';
import {
  type BoxPhoto,
  boxById,
  boxPhotos,
  boxStats,
  currentRole,
  isProNow,
  markerById,
  roomById,
  selectBoxItems,
  statusById,
  useStore,
} from '@/store/useStore';

export function useBoxDetail(boxId: string) {
  const role = useStore(currentRole);
  const box = useStore((s) => boxById(s, boxId));
  const session = useStore((s) => s.session);
  const isPro = useStore(isProNow);
  const rooms = useStore((s) => s.rooms);

  // Store actions (grabbed individually so selectors stay stable).
  const startProTrial = useStore((s) => s.startProTrial);
  const setBoxStatus = useStore((s) => s.setBoxStatus);
  const setBoxCover = useStore((s) => s.setBoxCover);
  const addStatus = useStore((s) => s.addStatus);
  const toggleBoxMarker = useStore((s) => s.toggleBoxMarker);
  const addMarker = useStore((s) => s.addMarker);
  const deleteBox = useStore((s) => s.deleteBox);
  const updateBox = useStore((s) => s.updateBox);

  // Resolve recipe — turn the box's ids into display data.
  const status = useStore((s) => (box ? statusById(s, box.status) : undefined));
  const room = useStore((s) => (box ? roomById(s, box.roomId) : undefined));
  const allStatuses = useStore((s) => s.statuses);
  const allMarkers = useStore((s) => s.markers);
  const boxMarkerDefs = useStore(
    useShallow((s) =>
      box ? (box.markers.map((mid) => markerById(s, mid)).filter(Boolean) as Marker[]) : [],
    ),
  );
  const items = useStore((s) => selectBoxItems(s, boxId));
  const stats = useStore(useShallow((s) => (box ? boxStats(s, boxId) : { count: 0, value: 0 })));

  // Combined photo gallery (cover + item photos). Derive off stable slices —
  // boxPhotos builds a fresh array, so it can't be a live selector.
  const allBoxes = useStore((s) => s.boxes);
  const itemsByBox = useStore((s) => s.itemsByBox);
  const photos = useMemo<BoxPhoto[]>(
    () => boxPhotos({ boxes: allBoxes, itemsByBox }, boxId),
    [allBoxes, itemsByBox, boxId],
  );

  const canEdit = box ? PERM.canEdit(role) : false;
  const canDelete = box ? PERM.canDelete(role) : false;

  return {
    box,
    room,
    status,
    session,
    isPro,
    rooms,
    allStatuses,
    allMarkers,
    boxMarkerDefs,
    items,
    stats,
    photos,
    canEdit,
    canDelete,
    actions: {
      startProTrial,
      setBoxStatus,
      setBoxCover,
      addStatus,
      toggleBoxMarker,
      addMarker,
      deleteBox,
      updateBox,
    },
  };
}
