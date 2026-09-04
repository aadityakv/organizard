// The inline camera: permission, open/close, flash, and taking a picture. Each
// capture is copied to the document dir (a stable `local:` ref) and handed to the
// form through `onPhoto`.
import { useRef, useState } from 'react';
import { LayoutAnimation } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';

import { persistCapture } from '@/lib/photos';

import { FLASH_CONFIG } from './constants';

/** Camera permission, open/close state and capture-to-persisted-ref for the item form. */
export function useCapture(onPhoto: (ref: string) => void) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [capturing, setCapturing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const permissionGranted = permission?.granted ?? false;
  const permissionDenied = permission != null && !permission.granted && !permission.canAskAgain;

  // Open the inline camera card. If the user hasn't granted access yet, ask —
  // and whatever the outcome, surface the card so they see the inline prompt.
  const openCamera = async () => {
    if (!permissionGranted) {
      const res = await requestPermission();
      if (!res?.granted) {
        setCameraOpen(true);
        return;
      }
    }
    setCameraOpen(true);
  };

  const closeCamera = () => setCameraOpen(false);
  const toggleFlash = () => setFlash((f) => (f === 'on' ? 'off' : 'on'));

  const capture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      if (pic?.uri) {
        const ref = await persistCapture(pic.uri);
        LayoutAnimation.configureNext(FLASH_CONFIG);
        onPhoto(ref);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    } catch {
      // capture can fail if the camera is mid-teardown — keep the UI calm.
    } finally {
      setCapturing(false);
    }
  };

  return {
    cameraRef,
    permission,
    permissionGranted,
    permissionDenied,
    requestPermission,
    flash,
    toggleFlash,
    capturing,
    capture,
    cameraOpen,
    openCamera,
    closeCamera,
  };
}

export type Capture = ReturnType<typeof useCapture>;
