// Photo upload + display for shared moves. Capture stays local (instant); the
// sync engine uploads any local-uri item photos to R2 and the next delta swaps
// them for photo ids. Display resolves a photo (local uri OR server id) to a source.
import { api } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { useStore } from '@/store/useStore';

const inFlight = new Set<string>();

const isLocalUri = (p: string): boolean => p.startsWith('file://') || p.startsWith('content://') || p.startsWith('/');

/** Upload one local photo, link it to its item/box, and return the server photo id. */
export async function uploadPhoto(
  session: string,
  moveId: string,
  localUri: string,
  link: { itemId?: string; boxId?: string },
): Promise<string> {
  const { photoId, uploadPath } = await api.createPhoto(session, moveId, link);
  const blob = await (await fetch(localUri)).blob();
  await fetch(`${API_URL}${uploadPath}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${session}`, 'content-type': 'image/jpeg' },
    body: blob,
  });
  return photoId;
}

/** Upload any not-yet-uploaded local item photos AND box covers for the active shared move. */
export async function uploadPendingPhotos(): Promise<void> {
  const s = useStore.getState();
  if (s.activeMode !== 'shared' || !s.session || !s.serverMoveId) return;
  const { session, serverMoveId } = s;

  for (const [boxId, items] of Object.entries(s.itemsByBox)) {
    for (const it of items) {
      for (const photo of it.photos ?? []) {
        if (!isLocalUri(photo) || inFlight.has(photo)) continue;
        inFlight.add(photo);
        try {
          const photoId = await uploadPhoto(session, serverMoveId, photo, { itemId: it.id });
          useStore.getState().swapItemPhoto(boxId, it.id, photo, photoId); // local uri -> server id (stops re-upload)
        } catch {
          // leave it; retried next sync tick
        } finally {
          inFlight.delete(photo);
        }
      }
    }
  }

  for (const b of s.boxes) {
    if (!b.cover || !isLocalUri(b.cover) || inFlight.has(b.cover)) continue;
    inFlight.add(b.cover);
    try {
      const photoId = await uploadPhoto(session, serverMoveId, b.cover, { boxId: b.id });
      useStore.getState().setBoxCover(b.id, photoId); // swap local uri -> server id (and enqueue)
    } catch {
      // retried next tick
    } finally {
      inFlight.delete(b.cover);
    }
  }
}

/** Resolve a stored photo (local uri or server id) to an <Image> source. */
export function photoSource(photo: string, session: string | null): { uri: string; headers?: Record<string, string> } {
  if (isLocalUri(photo)) return { uri: photo };
  return {
    uri: `${API_URL}/v1/photos/${photo}`,
    ...(session ? { headers: { Authorization: `Bearer ${session}` } } : {}),
  };
}
