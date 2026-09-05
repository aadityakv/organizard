// Photo device adapters (no store, no network): capture is persisted to the
// document directory (survives refresh/reinstall) and stored as a re-resolvable
// `local:` ref; display resolves a stored photo (local ref OR server id) to an
// <Image> source. The pure resolution logic lives in `@/lib/photoRef`
// (unit-tested); uploading to R2 lives in `@/services/photos`.
import * as FileSystem from 'expo-file-system/legacy';

import { API_URL } from '@/lib/api/config';
import { uid, ID_PREFIX } from '@/lib/uid';
import { LOCAL_PREFIX, resolvePhoto } from './refs';

/** Copy a capture out of the volatile cache dir into the document dir and return a relative `local:` ref that survives reinstall. */
export async function persistCapture(srcUri: string): Promise<string> {
  const docDir = FileSystem.documentDirectory;
  if (!docDir) return srcUri;
  const dir = `${docDir}photos/`;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    // already exists — fine.
  }
  const filename = `${uid(ID_PREFIX.photo)}.jpg`;
  await FileSystem.copyAsync({ from: srcUri, to: `${dir}${filename}` });
  return `${LOCAL_PREFIX}photos/${filename}`;
}

/** The <Image> source for an item's first photo, or undefined when it has none. */
export function firstPhotoSource(
  item: { photos?: string[] },
  session: string | null,
): { uri: string; headers?: Record<string, string> } | undefined {
  const first = item.photos?.[0];
  return first ? photoSource(first, session) : undefined;
}

/** Resolve a stored photo (local ref or server id) to an <Image> source. */
export function photoSource(
  photo: string,
  session: string | null,
): { uri: string; headers?: Record<string, string> } {
  return resolvePhoto(photo, {
    documentDirectory: FileSystem.documentDirectory,
    apiUrl: API_URL,
    session,
  });
}
