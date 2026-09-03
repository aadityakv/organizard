// Cover sheet — snap a box photo (expo-camera) with a friendly permission fallback.
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Linking from 'expo-linking';

import { Button, Sheet } from '@/components';
import { persistCapture } from '@/lib/photos';
import { palette, radius } from '@/theme';

import { shared } from './styles';

export function CoverSheet({
  visible,
  hasCover,
  onCapture,
  onRemove,
  onClose,
}: {
  visible: boolean;
  hasCover: boolean;
  onCapture: (uri: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);

  const capture = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const pic = await cameraRef.current?.takePictureAsync({ quality: 0.6 });
      if (pic?.uri) {
        const ref = await persistCapture(pic.uri);
        onCapture(ref);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Box photo">
      {!permission ? (
        <Text style={shared.sheetBlurb}>Getting the camera ready&hellip;</Text>
      ) : !permission.granted ? (
        <View>
          <Text style={shared.sheetBlurb}>
            {permission.canAskAgain
              ? 'Allow camera access to snap a quick photo of this box.'
              : 'Camera access is off. Turn it on in Settings to add a box photo.'}
          </Text>
          <View style={shared.doneButton}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              iconLeft="camera"
              onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
            >
              {permission.canAskAgain ? 'Allow camera' : 'Open settings'}
            </Button>
          </View>
        </View>
      ) : (
        <View>
          <View style={styles.cameraFrame}>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
          </View>
          <View style={shared.doneButton}>
            <Button variant="primary" size="lg" fullWidth iconLeft="camera" disabled={busy} onPress={capture}>
              {busy ? 'Saving…' : 'Take photo'}
            </Button>
          </View>
        </View>
      )}
      {hasCover ? (
        <View style={styles.removeCover}>
          <Button variant="ghost" size="md" fullWidth iconLeft="trash-2" onPress={onRemove}>
            Remove photo
          </Button>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cameraFrame: {
    height: 240,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: palette.ink900,
  },
  removeCover: { marginTop: 8 },
});
