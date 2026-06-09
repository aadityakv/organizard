// Photo upload + display for shared moves. Capture is persisted to the document
// directory (survives refresh/reinstall) and stored as a re-resolvable `local:`
// ref; the sync engine uploads any local item photos to R2 and the next delta
// swaps them for photo ids. Display resolves a photo (local ref OR server id) to
// a source. The pure resolution logic lives in `@/lib/photoRef` (unit-tested).
import * as FileSystem from 'expo-file-system/legacy';
import { api } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { useStore } from '@/store/useStore';
import { uid } from '@/lib/uid';
import { LOCAL_PREFIX, isLocalRef, resolvePhoto } from '@/lib/photoRef';

const inFlight = new Set<string>();

const isLocalUri = (p: string): boolean => isLocalRef(p);

/**
 * Copy a fresh camera capture out of the (volatile) cache directory into the
 * persistent document directory and return a stable, re-resolvable ref
 * (`local:photos/<id>.jpg`). The ref is RELATIVE — the absolute path is rejoined
 * with the freshly-read documentDirectory at render time so it survives the
 * container-UUID change on reinstall. If the doc dir is unavailable (shouldn't
 * happen on device) we return the source uri unchanged so capture never throws.
 */
export async function persistCapture(srcUri: string): Promise<string> {
  const docDir = FileSystem.documentDirectory;
  if (!docDir) return srcUri;
  const dir = `${docDir}photos/`;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    // already exists — fine.
  }
  const filename = `${uid('ph')}.jpg`;
  await FileSystem.copyAsync({ from: srcUri, to: `${dir}${filename}` });
  return `${LOCAL_PREFIX}photos/${filename}`;
}

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
    if (!b.cover || !isLocalUri(b.cover) || inFlight.has(b.cover)) continue;
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

/** Resolve a stored photo (local ref or server id) to an <Image> source. */
export function photoSource(photo: string, session: string | null): { uri: string; headers?: Record<string, string> } {
  return resolvePhoto(photo, {
    documentDirectory: FileSystem.documentDirectory,
    apiUrl: API_URL,
    session,
  });
}
