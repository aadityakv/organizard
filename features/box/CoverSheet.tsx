// Cover sheet — snap a box photo (expo-camera) with a friendly permission fallback.
import { StyleSheet, Text, View } from 'react-native';
import { CameraView } from 'expo-camera';
import * as Linking from 'expo-linking';

import { Button, Sheet } from '@/components';
import { useCameraCapture } from '@/hooks/useCameraCapture';
import { palette, radius } from '@/theme';

import { shared } from './styles';
import { copy } from '@/copy/box';

/** Sheet to capture a new cover photo or remove the current one. */
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
  const { cameraRef, permission, requestPermission, busy, snap } = useCameraCapture();

  const capture = async () => {
    const ref = await snap();
    if (ref != null) onCapture(ref);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={copy.coverPhotoLabel}>
      {!permission ? (
        <Text style={shared.sheetBlurb}>{copy.cameraStarting}</Text>
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
            {copy.removeCoverButton}
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
