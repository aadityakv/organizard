// Scan a box label: QR viewfinder plus the four result states (a box in this move,
// a box in another move on this device, a code we cannot see, not a Tuck code).
// Read-only, so every role can use it.
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components';
import { copy } from '@/copy/scan';
import { buildResultView, PermissionGate, ResultSheet } from '@/features/scan';
import { classifyScan, type ScanCandidateMove, type ScanResult } from '@/lib/qr/codes';
import { routes } from '@/lib/routes';
import { useStore } from '@/store/useStore';
import { alpha, colors, fonts, palette, radius, shadow, space, pressed } from '@/theme';

/** QR scanner with the four result states: this move, another move, no access, unknown code. */
export default function Scan() {
  const boxes = useStore((s) => s.boxes);
  const library = useStore((s) => s.library);
  const currentMoveId = useStore((s) => s.currentMoveId);
  const switchMove = useStore((s) => s.switchMove);
  // The other moves on this device, so a label from one of them offers a jump.
  const otherMoves = useMemo<ScanCandidateMove[]>(
    () =>
      Object.values(library)
        .filter((b) => b.id !== currentMoveId)
        .map((b) => ({ id: b.id, name: b.move.name, boxIds: b.boxes.map((x) => x.id) })),
    [library, currentMoveId],
  );

  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<ScanResult | null>(null);

  // The first scan wins: once a result is showing, further barcode events are ignored
  // until the user taps "Scan again".
  const handleValue = useCallback(
    (value: string) => {
      setResult(
        (current) =>
          current ??
          classifyScan(
            value,
            boxes.map((b) => b.id),
            otherMoves,
          ),
      );
    },
    [boxes, otherMoves],
  );

  const handleBarcode = useCallback(
    ({ data }: BarcodeScanningResult) => {
      handleValue(data);
    },
    [handleValue],
  );

  const rescan = useCallback(() => setResult(null), []);

  const jumpToMove = useCallback(
    (moveId: string, boxId: string) => {
      switchMove(moveId);
      router.replace(routes.box(boxId));
    },
    [switchMove],
  );

  // Build the view for the active result. The result is a snapshot of one scan, so
  // reading the store once here (rather than subscribing to all of it) is enough.
  const view = result ? buildResultView(result, useStore.getState(), rescan, jumpToMove) : null;
  if (!permission) {
    return <SafeAreaView style={styles.loading} edges={['top', 'bottom']} />;
  }
  if (!permission.granted) {
    return <PermissionGate denied={!permission.canAskAgain} onRequest={requestPermission} />;
  }
  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        // Stop delivering events the moment we have a result.
        onBarcodeScanned={result ? undefined : handleBarcode}
      />
      {/* Darken the camera feed so the chrome reads clearly. */}
      <View style={styles.dim} pointerEvents="none" />

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Back"
            accessibilityRole="button"
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Icon name="chevron-left" size={22} color={palette.white} />
          </Pressable>
          <Text style={styles.topTitle}>{copy.screenTitle}</Text>
        </View>

        <View style={styles.windowWrap} pointerEvents="none">
          <View style={styles.window}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {!result && <View style={styles.scanLine} />}
          </View>
          {!result && <Text style={styles.windowHint}>{copy.viewfinderHint}</Text>}
        </View>
      </SafeAreaView>

      {view && <ResultSheet view={view} onRescan={rescan} />}
    </View>
  );
}

const VIEWFINDER_BG = palette.cameraViewfinder;
const GREEN = palette.green400;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: VIEWFINDER_BG },
  loading: { flex: 1, backgroundColor: colors.surfaceApp },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: alpha(palette.cameraDim, 0.45) },
  overlay: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2] + 2,
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[2],
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: alpha(palette.white, 0.16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    color: palette.white,
    fontFamily: fonts.display.bold,
    fontSize: 19,
  },
  windowWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[5],
  },
  window: { width: 220, height: 220 },
  corner: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderColor: GREEN,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 },
  scanLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: '50%',
    height: 3,
    borderRadius: 3,
    backgroundColor: GREEN,
    ...shadow.brand,
  },
  windowHint: {
    color: alpha(palette.white, 0.72),
    fontFamily: fonts.body.bold,
    fontSize: 14,
  },
  pressed,
});
