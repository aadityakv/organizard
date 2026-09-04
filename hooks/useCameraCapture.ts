// The shared camera core: the permission pair and a busy-guarded snap that
// persists the capture out of the volatile cache dir as a stable `local:` ref.
// (The stream session uses its own variant — its background captures are
// deliberately unguarded and sequence-matched; see features/stream/useSnapCapture.)
import { useCallback, useRef, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { persistCapture } from '@/lib/photos';

/** Camera ref + permission state + a guarded take-picture returning a persisted ref. */
export function useCameraCapture() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);

  const permissionGranted = permission?.granted ?? false;
  const permissionDenied = permission != null && !permission.granted && !permission.canAskAgain;

  const snap = useCallback(async (): Promise<string | null> => {
    if (busy) return null;
    setBusy(true);
    try {
      const pic = await cameraRef.current?.takePictureAsync({ quality: 0.6 });
      return pic?.uri ? await persistCapture(pic.uri) : null;
    } catch {
      // Capture can fail if the camera is mid-teardown — keep the UI calm.
      return null;
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return { cameraRef, permission, permissionGranted, permissionDenied, requestPermission, busy, snap };
}
