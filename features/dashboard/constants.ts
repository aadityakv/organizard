// Static configuration for the dashboard: grouping modes, the status sort order
// and the room icon palette offered when creating/editing a room.
export type GroupView = 'room' | 'status' | 'value';

export const GROUP_OPTIONS: { value: GroupView; label: string }[] = [
  { value: 'room', label: 'Room' },
  { value: 'status', label: 'Status' },
  { value: 'value', label: 'Value' },
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
