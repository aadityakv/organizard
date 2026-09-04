// The inline camera: permission, open/close, flashOn, and taking a picture. Each
// capture is copied to the document dir (a stable `local:` ref) and handed to the
// form through `onPhoto`.
import { useState } from 'react';
import { LayoutAnimation } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useCameraCapture } from '@/hooks/useCameraCapture';

import { FLASH_CONFIG } from './constants';

/** Camera permission, open/close state and capture-to-persisted-ref for the item form. */
export function useCapture(onPhoto: (ref: string) => void) {
  const { cameraRef, permission, permissionGranted, permissionDenied, requestPermission, busy, snap } =
    useCameraCapture();
  const [flashOn, setFlashOn] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

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
  const toggleFlash = () => setFlashOn((on) => !on);

  const capture = async () => {
    const ref = await snap();
    if (ref != null) {
      LayoutAnimation.configureNext(FLASH_CONFIG);
      onPhoto(ref);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  return {
    cameraRef,
    permission,
    permissionGranted,
    permissionDenied,
    requestPermission,
    flashOn,
    toggleFlash,
    capturing: busy,
    capture,
    cameraOpen,
    openCamera,
    closeCamera,
  };
}

export type Capture = ReturnType<typeof useCapture>;
