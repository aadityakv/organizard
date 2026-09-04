// The inline camera card: a live viewfinder with flash / shutter / done controls,
// or — until access is granted — the permission prompt in the same frame.
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView } from 'expo-camera';

import { Button, Icon } from '@/components';
import { colors, fonts, fontSize, palette, radius, shadow, space, alpha } from '@/theme';

import { CAMERA_CARD_H } from './constants';
import type { Capture } from './useCapture';
import { copy } from '@/copy/addItem';

/** Inline camera card for the item form: live viewfinder with capture controls, or the permission prompt. */
export function CameraCard({ capture }: { capture: Capture }) {
  const { cameraRef, permission, permissionGranted, permissionDenied, requestPermission } = capture;
  return (
    <View style={styles.cameraCard}>
      {permissionGranted ? (
        <>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={capture.flashOn}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cameraScrim]} />

          <View style={styles.cameraControls}>
            <Pressable
              onPress={capture.toggleFlash}
              accessibilityRole="button"
              accessibilityLabel={capture.flashOn ? 'Turn flash off' : 'Turn flash on'}
              hitSlop={8}
              style={({ pressed }) => [
                styles.glassBtn,
                capture.flashOn && styles.glassBtnActive,
                pressed && styles.glassBtnPressed,
              ]}
            >
              <Icon name={capture.flashOn ? 'zap' : 'zap-off'} size={18} color={palette.white} />
            </Pressable>

            <Pressable
              onPress={capture.capture}
              disabled={capture.capturing}
              accessibilityRole="button"
              accessibilityLabel="Capture photo"
              style={({ pressed }) => [
                styles.shutter,
                pressed && styles.shutterPressed,
                capture.capturing && styles.shutterDim,
              ]}
            >
              <Icon name="camera" size={24} color={palette.white} />
            </Pressable>

            <Pressable
              onPress={capture.closeCamera}
              accessibilityRole="button"
              accessibilityLabel="Done taking photos"
              hitSlop={8}
              style={({ pressed }) => [styles.glassBtn, pressed && styles.glassBtnPressed]}
            >
              <Icon name="chevron-down" size={20} color={palette.white} />
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.permStack}>
          <View style={styles.permGlyph}>
            <Icon name="camera" size={24} color={palette.white} />
          </View>
          {permission == null ? (
            <Text style={styles.permTitle}>{copy.cameraStarting}</Text>
          ) : permissionDenied ? (
            <>
              <Text style={styles.permTitle}>{copy.cameraDeniedTitle}</Text>
              <Text style={styles.permBody}>{copy.cameraDeniedBody}</Text>
              <Button
                variant="secondary"
                size="md"
                iconLeft="settings"
                onPress={() => Linking.openSettings()}
                style={styles.permBtn}
              >
                {copy.openSettingsButton}
              </Button>
            </>
          ) : (
            <>
              <Text style={styles.permTitle}>{copy.cameraPromptTitle}</Text>
              <Text style={styles.permBody}>{copy.cameraPromptBody}</Text>
              <Button
                variant="secondary"
                size="md"
                iconLeft="camera"
                onPress={requestPermission}
                style={styles.permBtn}
              >
                {copy.allowCameraButton}
              </Button>
            </>
          )}
          <Pressable
            onPress={capture.closeCamera}
            accessibilityRole="button"
            accessibilityLabel="Not now"
            hitSlop={8}
            style={({ pressed }) => [styles.notNowBtn, pressed && styles.notNowBtnPressed]}
          >
            <Text style={styles.notNowText}>{copy.skipCameraButton}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cameraCard: {
    height: CAMERA_CARD_H,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: palette.cameraCard,
  },
  cameraScrim: {
    backgroundColor: alpha(palette.cameraInk, 0.22),
  },
  cameraControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[5],
    paddingBottom: space[3],
    paddingTop: space[3],
  },
  glassBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: alpha(palette.white, 0.16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassBtnActive: {
    backgroundColor: alpha(palette.amber400, 0.55),
  },
  glassBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },
  shutter: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    borderWidth: 4,
    borderColor: palette.green100,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...shadow.brand,
  },
  shutterPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
  shutterDim: {
    opacity: 0.5,
  },

  permStack: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[6],
    gap: space[2],
  },
  permGlyph: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: alpha(palette.white, 0.14),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[1],
  },
  permTitle: {
    fontFamily: fonts.display.semibold,
    fontSize: fontSize.md,
    color: palette.white,
    textAlign: 'center',
  },
  permBody: {
    fontFamily: fonts.body.semibold,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: alpha(palette.white, 0.72),
    textAlign: 'center',
  },
  permBtn: {
    marginTop: space[2],
  },
  notNowBtn: {
    marginTop: space[1],
    paddingVertical: space[1],
    paddingHorizontal: space[3],
  },
  notNowBtnPressed: {
    opacity: 0.6,
  },
  notNowText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: alpha(palette.white, 0.7),
  },
});
