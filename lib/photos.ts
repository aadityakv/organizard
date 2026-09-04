// Photo device adapters (no store, no network): capture is persisted to the
// document directory (survives refresh/reinstall) and stored as a re-resolvable
// `local:` ref; display resolves a stored photo (local ref OR server id) to an
// <Image> source. The pure resolution logic lives in `@/lib/photoRef`
// (unit-tested); uploading to R2 lives in `@/services/photos`.
import * as FileSystem from 'expo-file-system/legacy';

import { API_URL } from '@/lib/config';
import { uid } from '@/lib/uid';
import { LOCAL_PREFIX, resolvePhoto } from '@/lib/photoRef';

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
  const filename = `${uid('ph')}.jpg`;
  await FileSystem.copyAsync({ from: srcUri, to: `${dir}${filename}` });
  return `${LOCAL_PREFIX}photos/${filename}`;
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
