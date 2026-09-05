// Organizard — domain types
// Hierarchy: Move › Room › Box › Item. Destination is optional.

import type { Role } from '@/shared';

export type { Role };

export interface Move {
  name: string;
  from: string;
  to: string;
  /** Target date, e.g. "Jul 12". */
  target: string;
}

export interface Room {
  id: string;
  name: string;
  /** Where it lands at the new place — optional. */
  dest: string | null;
  /** Lucide icon name (kebab-case). */
  icon: string;
  /** Box-palette hue name. */
  color: string;
}

/** A box's single lifecycle state. Four ship as starters; users add their own. */
export interface Status {
  id: string;
  label: string;
  /** Box-palette hue name (see theme boxPalette). */
  color: string;
  /** True for user-created statuses. */
  custom?: boolean;
}

/** A handling flag on a box (or item). Many per box. */
export interface Marker {
  id: string;
  label: string;
  /** Box-palette hue name. */
  color: string;
  /** Lucide icon name (kebab-case). */
  icon: string;
  /** True for user-created markers. */
  custom?: boolean;
}

export interface Box {
  id: string;
  number: number;
  name: string;
  /** Box-palette hue name. */
  color: string;
  roomId: string;
  /** Status id (references a Status). */
  status: string;
  markers: string[]; // Marker ids
  /** Optional cover-photo URI. */
  cover?: string | null;
}

export interface Item {
  id: string;
  boxId: string;
  name: string;
  qty: number;
  value: number;
  /** Lucide glyph used when no photo is present. */
  icon?: string;
  /** Free-text note; null after an explicit clear (distinct from "unchanged"). */
  note?: string | null;
  markers?: string[]; // Marker ids
  /** Captured photo refs (local: uris before upload, server ids after). */
  photos?: string[];
  /** When the item was ticked off while unpacking; null or absent while still packed. */
  unpackedAt?: number | null;
}

/** Whether an item has been ticked off during unpacking (absent and null both mean packed). */
export const isUnpacked = (it: Pick<Item, 'unpackedAt'>): boolean => it.unpackedAt != null;

export interface Member {
  id: string;
  name: string;
  role: Role;
}

/** A flattened item with its location breadcrumb — powers "Find". */
export interface IndexedItem extends Item {
  boxName: string;
  boxNumber: number;
  boxColor: string;
  /** Status id of the owning box, so Find can filter items by where the box is. */
  boxStatus: string;
  roomId: string;
  roomName: string;
}
