// The lifecycle statuses and handling markers every new move starts with.
import type { Marker, Status } from './types';

/** Ids of the built-in statuses; the store and selectors refer to these, custom ones are uid-generated. */
export const STATUS_ID = {
  packing: 'packing',
  sealed: 'sealed',
  transit: 'transit',
  unpacked: 'unpacked',
} as const;

export const STARTER_STATUSES: Status[] = [
  { id: STATUS_ID.packing, label: 'Packing', color: 'amber' },
  { id: STATUS_ID.sealed, label: 'Sealed', color: 'green' },
  { id: STATUS_ID.transit, label: 'In transit', color: 'sky' },
  { id: STATUS_ID.unpacked, label: 'Unpacked', color: 'slate' },
];

export const STARTER_MARKERS: Marker[] = [
  { id: 'mk_fragile', label: 'Fragile', color: 'coral', icon: 'wine' },
  { id: 'mk_open1', label: 'Open first', color: 'teal', icon: 'package-open' },
  { id: 'mk_heavy', label: 'Heavy', color: 'indigo', icon: 'dumbbell' },
  { id: 'mk_dry', label: 'Keep dry', color: 'sky', icon: 'umbrella' },
  { id: 'mk_up', label: 'This way up', color: 'amber', icon: 'arrow-up' },
];
