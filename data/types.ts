// ============================================================
// Organizard — domain types
// Hierarchy: Move › Room › Box › Item. Destination is optional.
// ============================================================

export type Role = 'owner' | 'editor' | 'viewer';

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
  note?: string;
  markers?: string[]; // Marker ids
  /** Captured photo URIs (expo-camera). */
  photos?: string[];
}

export interface Member {
  id: string;
  name: string;
  role: Role;
  /** True for the signed-in user. */
  you?: boolean;
}

/** A flattened item with its location breadcrumb — powers "Find". */
export interface IndexedItem extends Item {
  boxName: string;
  boxNumber: number;
  boxColor: string;
  roomId: string;
  roomName: string;
}
