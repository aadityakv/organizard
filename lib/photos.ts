// Photo upload + display for shared moves. Capture stays local (instant); the
// sync engine uploads any local-uri item photos to R2 and the next delta swaps
// them for photo ids. Display resolves a photo (local uri OR server id) to a source.
import { api } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { useStore } from '@/store/useStore';

const inFlight = new Set<string>();

const isLocalUri = (p: string): boolean => p.startsWith('file://') || p.startsWith('content://') || p.startsWith('/');

/** Upload one local photo, link it to its item, and return the server photo id. */
export async function uploadPhoto(session: string, moveId: string, localUri: string, itemId: string): Promise<string> {
  const { photoId, uploadPath } = await api.createPhoto(session, moveId, { itemId });
  const blob = await (await fetch(localUri)).blob();
  await fetch(`${API_URL}${uploadPath}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${session}`, 'content-type': 'image/jpeg' },
    body: blob,
  });
  return photoId;
}

/** Upload any not-yet-uploaded local item photos for the active shared move. */
export async function uploadPendingPhotos(): Promise<void> {
  const s = useStore.getState();
  if (s.activeMode !== 'shared' || !s.session || !s.serverMoveId) return;
  const { session, serverMoveId } = s;

  for (const items of Object.values(s.itemsByBox)) {
    for (const it of items) {
      for (const photo of it.photos ?? []) {
        if (!isLocalUri(photo) || inFlight.has(photo)) continue;
        inFlight.add(photo);
        try {
          await uploadPhoto(session, serverMoveId, photo, it.id);
        } catch {
          // leave it; retried next sync tick
        } finally {
          inFlight.delete(photo);
        }
      }
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
