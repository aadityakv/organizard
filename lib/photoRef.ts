// Pure photo-reference helpers (no expo/RN imports; unit-tested in node vitest).
// `lib/photos.ts` injects the real documentDirectory + API base so this module
// stays free of native deps and the resolution logic is testable in isolation.

// A `local:`-scheme ref is a RELATIVE path under the device document directory
// (e.g. "local:photos/abc.jpg"). It survives reinstalls because the absolute
// document-directory path — which embeds the container UUID — is rejoined at
// render time instead of being persisted.
export const LOCAL_PREFIX = 'local:';

/**
 * A stored photo ref that lives on this device — needs upload for shared moves,
 * resolves to a local file for display. Covers our `local:` refs plus legacy
 * absolute local paths persisted before the fix (back-compat).
 */
export const isLocalRef = (p: string): boolean =>
  p.startsWith(LOCAL_PREFIX) ||
  p.startsWith('file://') ||
  p.startsWith('content://') ||
  p.startsWith('/');

/** Resolve a stored photo ref to a displayable source, given the device doc dir + api base. */
export function resolvePhoto(
  photo: string,
  opts: { documentDirectory: string | null; apiUrl: string; session: string | null },
): { uri: string; headers?: Record<string, string> } {
  if (photo.startsWith(LOCAL_PREFIX)) {
    const rel = photo.slice(LOCAL_PREFIX.length); // e.g. "photos/abc.jpg"
    return { uri: `${opts.documentDirectory ?? ''}${rel}` };
  }
  if (photo.startsWith('file://') || photo.startsWith('content://') || photo.startsWith('/')) {
    return { uri: photo }; // legacy absolute local path (back-compat passthrough)
  }
  // server photo id
  return {
    uri: `${opts.apiUrl}/v1/photos/${photo}`,
    ...(opts.session ? { headers: { Authorization: `Bearer ${opts.session}` } } : {}),
  };
}
