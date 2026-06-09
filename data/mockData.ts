// ============================================================
// Mock data for the Organizard "NYC Move".
// Hierarchy: Move › Room › Box › Item. Seeds the store on first run.
// ============================================================
import type { Box, Item, Marker, Member, Move, Room, Status } from './types';

export const move: Move = {
  name: 'NYC Move',
  from: 'Austin, TX',
  to: 'Brooklyn, NY',
  target: 'Jul 12',
};

// Rooms group boxes. `dest` (where it lands at the new place) is optional.
export const rooms: Room[] = [
  { id: 'r_kitchen', name: 'Kitchen', dest: 'NYC kitchen', icon: 'cooking-pot', color: 'amber' },
  { id: 'r_office', name: 'Office', dest: 'Study', icon: 'briefcase', color: 'sky' },
  { id: 'r_bedroom', name: 'Bedroom', dest: 'Closet', icon: 'bed', color: 'rose' },
  { id: 'r_bath', name: 'Bathroom', dest: null, icon: 'bath', color: 'teal' },
  { id: 'r_living', name: 'Living room', dest: 'Living room', icon: 'sofa', color: 'slate' },
];

// Statuses (lifecycle) — four starters + a couple of custom examples.
export const statuses: Status[] = [
  { id: 'packing', label: 'Packing', color: 'amber' },
  { id: 'sealed', label: 'Sealed', color: 'green' },
  { id: 'transit', label: 'In transit', color: 'sky' },
  { id: 'unpacked', label: 'Unpacked', color: 'slate' },
  { id: 'donate', label: 'Donate pile', color: 'rose', custom: true },
  { id: 'firstnight', label: 'First-night box', color: 'teal', custom: true },
];

// Markers (handling flags) — standard icon set + user-created.
export const markers: Marker[] = [
  { id: 'mk_fragile', label: 'Fragile', color: 'coral', icon: 'wine' },
  { id: 'mk_open1', label: 'Open first', color: 'teal', icon: 'package-open' },
  { id: 'mk_heavy', label: 'Heavy', color: 'indigo', icon: 'dumbbell' },
  { id: 'mk_dry', label: 'Keep dry', color: 'sky', icon: 'umbrella' },
  { id: 'mk_up', label: 'This way up', color: 'amber', icon: 'arrow-up' },
];

export const boxes: Box[] = [
  { id: 'b1', number: 1, name: 'Kitchen essentials', color: 'amber', roomId: 'r_kitchen', status: 'sealed', markers: ['mk_fragile', 'mk_open1'], hasPhoto: true },
  { id: 'b2', number: 2, name: 'Books & records', color: 'indigo', roomId: 'r_office', status: 'packing', markers: ['mk_heavy'] },
  { id: 'b3', number: 3, name: 'Winter clothes', color: 'sky', roomId: 'r_bedroom', status: 'firstnight', markers: [] },
  { id: 'b4', number: 4, name: 'Bathroom', color: 'teal', roomId: 'r_bath', status: 'transit', markers: ['mk_dry'] },
  { id: 'b5', number: 5, name: 'Cables & tech', color: 'slate', roomId: 'r_office', status: 'packing', markers: ['mk_fragile'] },
  { id: 'b6', number: 6, name: 'Decor & frames', color: 'rose', roomId: 'r_living', status: 'donate', markers: [] },
];

// Items keyed by box id.
export const itemsByBox: Record<string, Item[]> = {
  b1: [
    { id: 'i1', boxId: 'b1', name: 'Cast iron skillet', qty: 1, value: 80, icon: 'cooking-pot' },
    { id: 'i2', boxId: 'b1', name: 'Stoneware mugs', qty: 6, value: 54, icon: 'coffee' },
    { id: 'i3', boxId: 'b1', name: 'Dinner plates', qty: 8, value: 96, icon: 'utensils', markers: ['mk_fragile'] },
    { id: 'i4', boxId: 'b1', name: 'Chef knife set', qty: 1, value: 140, icon: 'utensils-crossed' },
    { id: 'i5', boxId: 'b1', name: 'Stand mixer', qty: 1, value: 220, icon: 'blend', note: 'Wrapped in the blue towel', markers: ['mk_fragile', 'mk_heavy'] },
  ],
  b2: [
    { id: 'i6', boxId: 'b2', name: 'Vinyl records', qty: 40, value: 800, icon: 'disc-3' },
    { id: 'i7', boxId: 'b2', name: 'Hardcover novels', qty: 18, value: 280, icon: 'book' },
    { id: 'i8', boxId: 'b2', name: 'Turntable', qty: 1, value: 100, icon: 'audio-lines', markers: ['mk_fragile'] },
  ],
  b3: [
    { id: 'i12', boxId: 'b3', name: 'Wool coats', qty: 3, value: 360, icon: 'shirt' },
    { id: 'i13', boxId: 'b3', name: 'Down comforter', qty: 1, value: 180, icon: 'bed' },
  ],
  b4: [],
  b5: [
    { id: 'i9', boxId: 'b5', name: 'Laptop charger', qty: 1, value: 60, icon: 'cable' },
    { id: 'i10', boxId: 'b5', name: 'Mechanical keyboard', qty: 1, value: 120, icon: 'keyboard', markers: ['mk_heavy'] },
    { id: 'i11', boxId: 'b5', name: 'Monitor', qty: 1, value: 400, icon: 'monitor', note: 'Original box', markers: ['mk_fragile'] },
  ],
  b6: [],
};

export const members: Member[] = [
  { id: 'm1', name: 'Sam Rivera', role: 'owner', you: true },
  { id: 'm2', name: 'Jo Park', role: 'editor' },
  { id: 'm3', name: 'Alex Kim', role: 'viewer' },
];
