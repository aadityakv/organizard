// Server (shared) shapes -> client store shapes. The client keeps dollars +
// status/marker ids; the server keeps cents + join ids. These bridge the two.
import type {
  Box as SBox,
  Item as SItem,
  Marker as SMarker,
  Member as SMember,
  Room as SRoom,
  Status as SStatus,
} from '@/shared';
import type { Box, Item, Marker, Member, Room, Status } from '@/data/types';

/** Server room → client room. */
export const toClientRoom = (r: SRoom): Room => ({
  id: r.id,
  name: r.name,
  dest: r.dest ?? null,
  icon: r.icon,
  color: r.color ?? 'slate',
});

/** Server status → client status. */
export const toClientStatus = (r: SStatus): Status => ({
  id: r.id,
  label: r.label,
  color: r.color,
  custom: r.custom,
});

/** Server marker → client marker. */
export const toClientMarker = (r: SMarker): Marker => ({
  id: r.id,
  label: r.label,
  color: r.color,
  icon: r.icon,
  custom: r.custom,
});

/** Server box → client box (statusId → status, markerIds → markers). */
export const toClientBox = (b: SBox): Box => ({
  id: b.id,
  number: b.number,
  name: b.name,
  color: b.color,
  roomId: b.roomId,
  status: b.statusId,
  markers: b.markerIds,
  cover: b.coverPhotoId ?? null,
});

/** Server item → client item (cents → dollars). */
export const toClientItem = (i: SItem): Item => ({
  id: i.id,
  boxId: i.boxId,
  name: i.name,
  qty: i.qty,
  value: Math.round(i.valueCents) / 100,
  note: i.note ?? undefined,
  icon: i.icon ?? undefined,
  markers: i.markerIds,
  photos: i.photoIds, // server photo ids; resolve to URLs via photoSource()
});

/** Server member → client member (keyed by user id). */
export const toClientMember = (m: SMember): Member => ({ id: m.userId, name: m.name, role: m.role });
