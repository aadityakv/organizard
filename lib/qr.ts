// QR encoding for box labels. A box's QR encodes a deep link;
// scanning resolves it against the current move.

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
  | { kind: 'otherMove'; boxId: string; moveId: string; moveName: string }
  | { kind: 'noAccess' }
  | { kind: 'unknown'; value: string };

/** Another move on this device that a scanned box might belong to. */
export type ScanCandidateMove = { id: string; name: string; boxIds: string[] };

/** Classify a scanned value: a box in this move, in another move on this device, a Tuck code we cannot see, or not a Tuck code. */
export const classifyScan = (
  value: string,
  currentBoxIds: string[],
  otherMoves: ScanCandidateMove[] = [],
): ScanResult => {
  const id = parseBoxQR(value);
  if (id == null) return { kind: 'unknown', value };
  if (currentBoxIds.includes(id)) return { kind: 'thisMove', boxId: id };
  const other = otherMoves.find((m) => m.boxIds.includes(id));
  if (other) return { kind: 'otherMove', boxId: id, moveId: other.id, moveName: other.name };
  return { kind: 'noAccess' };
};
