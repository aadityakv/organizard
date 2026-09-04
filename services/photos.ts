// Photo upload for shared moves: local-URI item photos and box covers go to R2,
// then the store swaps the local ref for the server photo id (so it never
// re-uploads). Capture persistence and display-source resolution stay in
// lib/photos.ts (device adapters with no store access).
import * as FileSystem from 'expo-file-system/legacy';

import { api } from '@/lib/api';
import { API_URL } from '@/lib/api/config';
import { isLocalRef } from '@/lib/photos/refs';
import { photoSource } from '@/lib/photos';
import { useStore } from '@/store/useStore';
import { MOVE_MODE } from '@/store/library';

const inFlight = new Set<string>();

async function uploadPhoto(
  session: string,
  moveId: string,
  localUri: string,
  link: { itemId?: string; boxId?: string },
): Promise<string> {
  const { photoId, uploadPath } = await api.createPhoto(session, moveId, link);
  // Upload the file's bytes DIRECTLY via expo-file-system. The old path—
  // `(await fetch(localUri)).blob()`—THROWS on RN 0.85 ("Creating blobs from
  // 'ArrayBuffer' and 'ArrayBufferView' are not supported"), so every shared-move
  // photo upload failed: createPhoto had already reserved a server row, which then
  // synced back as an orphaned photo id (no R2 bytes) and rendered as a blank cover.
  const result = await FileSystem.uploadAsync(`${API_URL}${uploadPath}`, localUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { Authorization: `Bearer ${session}`, 'content-type': 'image/jpeg' },
  });
  // Don't report success on a non-2xx — otherwise the caller swaps the local ref for
  // a server id whose blob doesn't exist. Throwing keeps the local ref; sync retries.
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`photo upload failed (${result.status})`);
  }
  return photoId;
}

/** Upload any not-yet-uploaded local item photos AND box covers for the active shared move. */
export async function uploadPendingPhotos(): Promise<void> {
  const s = useStore.getState();
  if (s.activeMode !== MOVE_MODE.shared || !s.session || !s.serverMoveId) return;
  const { session, serverMoveId } = s;

  for (const [boxId, items] of Object.entries(s.itemsByBox)) {
    for (const it of items) {
      for (const photo of it.photos ?? []) {
        if (!isLocalRef(photo) || inFlight.has(photo)) continue;
        inFlight.add(photo);
        try {
          // Resolve a `local:` ref to the real document-dir uri the fetch can read.
          const localUri = photoSource(photo, session).uri;
          const photoId = await uploadPhoto(session, serverMoveId, localUri, { itemId: it.id });
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
    if (!b.cover || !isLocalRef(b.cover) || inFlight.has(b.cover)) continue;
    inFlight.add(b.cover);
    try {
      // Resolve a `local:` ref to the real document-dir uri the fetch can read.
      const localUri = photoSource(b.cover, session).uri;
      const photoId = await uploadPhoto(session, serverMoveId, localUri, { boxId: b.id });
      useStore.getState().setBoxCover(b.id, photoId); // swap local uri -> server id (and enqueue)
    } catch {
      // retried next tick
    } finally {
      inFlight.delete(b.cover);
    }
  }
}
