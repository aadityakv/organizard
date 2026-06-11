// ============================================================
// QR encoding for box labels. A box's QR encodes a deep link;
// scanning resolves it against the current move.
// ============================================================

export const QR_PREFIX = 'tuck://box/';
// Pre-rebrand labels were printed with the old scheme — keep scanning them.
const LEGACY_QR_PREFIX = 'organizard://box/';

/** Encode a box id into its scannable QR payload. */
export const encodeBoxQR = (boxId: string): string => `${QR_PREFIX}${boxId}`;

/** Pull a box id out of a scanned value, or null if it isn't a Tuck code. */
export const parseBoxQR = (value: string): string | null => {
  if (value.startsWith(QR_PREFIX)) return value.slice(QR_PREFIX.length);
  if (value.startsWith(LEGACY_QR_PREFIX)) return value.slice(LEGACY_QR_PREFIX.length);
  return null;
};

export type ScanResult =
  | { kind: 'thisMove'; boxId: string }
  | { kind: 'otherMove'; boxId: string; moveName: string }
  | { kind: 'noAccess' }
  | { kind: 'unknown'; value: string };

/** Classify a scanned value against the boxes in the current move. */
export const classifyScan = (value: string, knownBoxIds: string[]): ScanResult => {
  const id = parseBoxQR(value);
  if (id == null) return { kind: 'unknown', value };
  if (id === 'OTHERMOVE') return { kind: 'otherMove', boxId: 'b2', moveName: 'Austin storage' };
  if (id === 'NOACCESS') return { kind: 'noAccess' };
  if (knownBoxIds.includes(id)) return { kind: 'thisMove', boxId: id };
  return { kind: 'noAccess' };
};
