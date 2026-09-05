// User-facing copy for the scan screens. Keys stay stable; only the strings change.
export const copy = {
  boxFoundBody: "Open it to see what's inside.",
  boxFoundTitle: 'Box found',
  enableCameraButton: 'Turn on the camera',
  jumpButton: 'Jump to it',
  noAccessBody: 'Ask the owner to invite you, then scan it again.',
  noAccessTitle: "You don't have access to this box",
  openBoxButton: 'Open box',
  openSettingsButton: 'Open settings',
  otherMoveBody: 'You have access to that move. Want to jump over to it?',
  otherMoveTitle: (moveName: string) => `This box is in "${moveName}"`,
  permissionBody:
    "Tuck needs your camera so you can scan a box's QR label and jump straight to what's inside.",
  permissionDeniedBody: 'Camera access is off. Turn it on in Settings, then come back here.',
  permissionTitle: 'Point your camera at a box',
  scanAgainButton: 'Scan again',
  screenTitle: 'Scan a box',
  unpackButton: 'Unpack this box',
  unknownBody: "Double-check you're scanning a Tuck label, then try again.",
  unknownTitle: "That code isn't part of this move",
  viewfinderHint: "Line up a box's QR label",
} as const;
