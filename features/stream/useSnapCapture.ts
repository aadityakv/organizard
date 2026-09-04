// The camera side of capture: permission, the shutter flash, and the best-effort
// photo that gets attached to the next item. Photos are taken asynchronously; a
// sequence number guards against a slow capture attaching to a later item.
import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { persistCapture } from '@/lib/photos';

const FLASH_MS = 200;

/** Camera ref and snap-to-persisted-ref for the streaming session. */
export function useSnapCapture() {
  const cameraRef = useRef<CameraView>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [flash, setFlash] = useState(false);
  const flashTmo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPhoto = useRef<string | null>(null);
  const captureSeq = useRef(0); // matches an async photo to the capture that started it

  useEffect(() => {
    if (!camPerm?.granted && camPerm?.canAskAgain) void requestCamPerm();
  }, [camPerm?.granted, camPerm?.canAskAgain, requestCamPerm]);

  useEffect(
    () => () => {
      if (flashTmo.current) clearTimeout(flashTmo.current);
    },
    [],
  );

  const flashOnce = () => {
    setFlash(true);
    if (flashTmo.current) clearTimeout(flashTmo.current);
    flashTmo.current = setTimeout(() => setFlash(false), FLASH_MS);
  };

  const takePicture = async (): Promise<string | null> => {
    const pic = await cameraRef.current?.takePictureAsync({ quality: 0.6 });
    return pic?.uri ? persistCapture(pic.uri) : null;
  };

  // Take a photo (best-effort) and stash it for the item the next utterance creates.
  const capturePhoto = async (seq: number) => {
    try {
      const ref = await takePicture();
      if (ref && seq === captureSeq.current) pendingPhoto.current = ref;
    } catch (e) {
      console.warn('stream: photo capture failed', e); // item is still captured by voice
    }
  };

  /** Stream (Photos on): flash, then photograph in the background for the next item. */
  const snapForNextItem = () => {
    flashOnce();
    pendingPhoto.current = null;
    void capturePhoto((captureSeq.current += 1));
  };

  /** Capture view: flash and wait for the photo (null if it failed). */
  const snapOnce = async (): Promise<string | null> => {
    flashOnce();
    try {
      return await takePicture();
    } catch (e) {
      console.warn('capture: photo failed', e); // still let them name the item
      return null;
    }
  };

  /** Hand over the stashed photo (if any) to the item being created. */
  const takePendingPhoto = (): string | null => {
    const ref = pendingPhoto.current;
    pendingPhoto.current = null;
    return ref;
  };

  // Switching mode or view invalidates any in-flight / pending photo, so a slow stream
  // capture can't attach to a later item after a flip.
  const invalidatePending = useCallback(() => {
    pendingPhoto.current = null;
    captureSeq.current += 1;
  }, []);

  return {
    cameraRef,
    cameraGranted: !!camPerm?.granted,
    flash,
    snapForNextItem,
    snapOnce,
    takePendingPhoto,
    invalidatePending,
  };
}
