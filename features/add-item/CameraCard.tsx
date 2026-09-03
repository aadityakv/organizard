// The inline camera card: a live viewfinder with flash / shutter / done controls,
// or — until access is granted — the permission prompt in the same frame.
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView } from 'expo-camera';

import { Button, Icon } from '@/components';
import { colors, fonts, fontSize, palette, radius, shadow, space } from '@/theme';

import { CAMERA_CARD_H } from './constants';
import type { Capture } from './useCapture';

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
            enableTorch={capture.flash === 'on'}
          />
          {/* dim wash so the controls stay legible over any scene */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cameraScrim]} />

          <View style={styles.cameraControls}>
            <Pressable
              onPress={capture.toggleFlash}
              accessibilityRole="button"
              accessibilityLabel={capture.flash === 'on' ? 'Turn flash off' : 'Turn flash on'}
              hitSlop={8}
              style={({ pressed }) => [
                styles.glassBtn,
                capture.flash === 'on' && styles.glassBtnActive,
                pressed && styles.glassBtnPressed,
              ]}
            >
              <Icon name={capture.flash === 'on' ? 'zap' : 'zap-off'} size={18} color={palette.white} />
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
            <Text style={styles.permTitle}>Getting the camera ready…</Text>
          ) : permissionDenied ? (
            <>
              <Text style={styles.permTitle}>Camera access is off</Text>
              <Text style={styles.permBody}>
                Turn it on in settings to snap a photo as you pack. You can still add the item with just its
                details.
              </Text>
              <Button
                variant="secondary"
                size="md"
                iconLeft="settings"
                onPress={() => Linking.openSettings()}
                style={styles.permBtn}
              >
                Open settings
              </Button>
            </>
          ) : (
            <>
              <Text style={styles.permTitle}>Snap a photo as you pack</Text>
              <Text style={styles.permBody}>
                A quick picture makes items easy to spot later — but it&apos;s optional. Save without one
                anytime.
              </Text>
              <Button
                variant="secondary"
                size="md"
                iconLeft="camera"
                onPress={requestPermission}
                style={styles.permBtn}
              >
                Allow camera
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
            <Text style={styles.notNowText}>Not now</Text>
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
    backgroundColor: '#1B1D1C',
  },
  cameraScrim: {
    backgroundColor: 'rgba(20,22,21,0.22)',
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
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassBtnActive: {
    backgroundColor: 'rgba(242,162,60,0.55)',
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

  // Permission states (inside the camera card)
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
    backgroundColor: 'rgba(255,255,255,0.14)',
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
    color: 'rgba(255,255,255,0.72)',
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
    color: 'rgba(255,255,255,0.7)',
  },
});
