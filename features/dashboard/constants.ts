// Static configuration for the dashboard: grouping modes, the status sort order
// and the room icon palette offered when creating/editing a room.
export const GROUP_VIEW = { room: 'room', status: 'status', value: 'value' } as const;
export type GroupView = (typeof GROUP_VIEW)[keyof typeof GROUP_VIEW];

export const GROUP_OPTIONS: { value: GroupView; label: string }[] = [
  { value: GROUP_VIEW.room, label: 'Room' },
  { value: GROUP_VIEW.status, label: 'Status' },
  { value: GROUP_VIEW.value, label: 'Value' },
];

// Status-order used when sorting boxes in the non-room views (in_transit first,
// then packing, sealed, unpacked, anything custom last) — matches the design.
export const STATUS_ORDER: Record<string, number> = {
  transit: 0,
  packing: 1,
  sealed: 2,
  unpacked: 3,
};

export const ROOM_ICONS = [
  'box',
  'cooking-pot',
  'bed',
  'bath',
  'sofa',
  'briefcase',
  'shirt',
  'baby',
  'tv',
  'flower-2',
  'car',
  'dumbbell',
];

export const SEARCH_SUGGESTIONS = ['Cast iron skillet', 'Monitor', 'Fragile'];
