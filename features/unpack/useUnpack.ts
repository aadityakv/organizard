// Everything the unpack screen reads from the store, plus the two actions it fires.
// Selector discipline (see store/selectors.ts): unpackProgress builds a fresh object,
// so it goes through useShallow; items come back as the stable per-box array.
import { useShallow } from 'zustand/react/shallow';

import { STATUS_ID } from '@/data/defaults';
import { PERM } from '@/lib/permissions';
import {
  boxById,
  currentRole,
  roomById,
  selectBoxItems,
  statusById,
  unpackProgress,
  useStore,
} from '@/store/useStore';

/** Store subscriptions and derived data for unpacking one box. */
export function useUnpack(boxId: string) {
  const role = useStore(currentRole);
  const box = useStore((s) => boxById(s, boxId));
  const room = useStore((s) => (box ? roomById(s, box.roomId) : undefined));
  const status = useStore((s) => (box ? statusById(s, box.status) : undefined));
  const session = useStore((s) => s.session);
  const items = useStore((s) => selectBoxItems(s, boxId));
  const progress = useStore(useShallow((s) => unpackProgress(s, boxId)));
  const setItemUnpacked = useStore((s) => s.setItemUnpacked);
  const unpackBox = useStore((s) => s.unpackBox);

  return {
    box,
    room,
    status,
    session,
    items,
    progress,
    canEdit: box ? PERM.canEdit(role) : false,
    isDone: box?.status === STATUS_ID.unpacked,
    actions: { setItemUnpacked, unpackBox },
  };
}
