// Scan a box — QR viewfinder + the four result states (this move / another
// move / no access / unknown). Works for viewers too. Translated from the
// design prototype (ui_kits/packing/Scan.jsx) into Expo / React Native.
import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, SlothMark } from '@/components';
import { classifyScan, type ScanCandidateMove, type ScanResult } from '@/lib/qr';
import { useStore, boxById, roomById, boxStats, statusById, type Store } from '@/store/useStore';
import { boxColor, boxTint, colors, fonts, palette, radius, shadow, space } from '@/theme';
import { money } from '@/lib/money';

type ResultView = {
  icon: string;
  iconWash: string;
  iconColor: string;
  title: string;
  body: string;
  actionLabel: string;
  actionIcon: string;
  actionVariant: 'primary' | 'secondary';
  onAction: () => void;
};

function ResultSheet({ view, onRescan }: { view: ResultView; onRescan: () => void }) {
  return (
    <View style={styles.sheet}>
      <View style={styles.grabber} />
      <View style={styles.sheetHeader}>
        <View style={[styles.resultIcon, { backgroundColor: view.iconWash }]}>
          <Icon name={view.icon} size={26} color={view.iconColor} />
        </View>
        <View style={styles.sheetCopy}>
          <Text style={styles.sheetTitle}>{view.title}</Text>
          <Text style={styles.sheetBody}>{view.body}</Text>
        </View>
      </View>
      <View style={styles.sheetActions}>
        <Button
          variant={view.actionVariant}
          size="lg"
          fullWidth
          iconLeft={view.actionIcon}
          onPress={view.onAction}
        >
          {view.actionLabel}
        </Button>
        {view.actionVariant === 'primary' && (
          <Pressable
            onPress={onRescan}
            style={({ pressed }) => [styles.rescanLink, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Icon name="scan-line" size={16} color={palette.ink500} />
            <Text style={styles.rescanText}>Scan again</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function PermissionGate({ denied, onRequest }: { denied: boolean; onRequest: () => void }) {
  return (
    <SafeAreaView style={styles.permSafe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.permContent} showsVerticalScrollIndicator={false}>
        <View style={styles.permIconWrap}>
          <SlothMark size={56} />
        </View>
        <Text style={styles.permTitle}>Point your camera at a box</Text>
        <Text style={styles.permBody}>
          Tuck needs your camera so you can scan a box&apos;s QR label and jump straight to what&apos;s
          inside.
        </Text>
        {denied ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            iconLeft="settings"
            onPress={() => Linking.openSettings()}
          >
            Open settings
          </Button>
        ) : (
          <Button variant="primary" size="lg" fullWidth iconLeft="camera" onPress={onRequest}>
            Turn on the camera
          </Button>
        )}
        {denied && (
          <Text style={styles.permHint}>
            Camera access is off. Turn it on in Settings, then come back here.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

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
      router.replace(`/box/${boxId}`);
    },
    [switchMove],
  );

  // Build the view for the active result. The result is a snapshot of one scan, so
  // reading the store once here (rather than subscribing to all of it) is enough.
  const view = result ? buildView(result, useStore.getState(), rescan, jumpToMove) : null;
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
          <Text style={styles.topTitle}>Scan a box</Text>
        </View>

        <View style={styles.windowWrap} pointerEvents="none">
          <View style={styles.window}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {!result && <View style={styles.scanLine} />}
          </View>
          {!result && <Text style={styles.windowHint}>Line up a box&apos;s QR label</Text>}
        </View>
      </SafeAreaView>

      {view && <ResultSheet view={view} onRescan={rescan} />}
    </View>
  );
}

function buildView(
  result: ScanResult,
  store: Store,
  rescan: () => void,
  jumpToMove: (moveId: string, boxId: string) => void,
): ResultView {
  if (result.kind === 'thisMove') {
    const box = boxById(store, result.boxId);
    const room = box ? roomById(store, box.roomId) : undefined;
    const status = box ? statusById(store, box.status) : undefined;
    const stats = box ? boxStats(store, box.id) : { count: 0, value: 0 };
    const hue = box?.color ?? 'green';
    const open = () => router.push(`/box/${result.boxId}`);
    return {
      icon: 'package-check',
      iconWash: boxTint(hue),
      iconColor: boxColor(hue),
      title: box ? `Box #${box.number} · ${box.name}` : 'Box found',
      body: box
        ? `${room?.name ?? ''} — ${stats.count} items · ${money(stats.value)}${
            status?.label ? ` · ${status.label}` : ''
          }`
        : "Open it to see what's inside.",
      actionLabel: 'Open box',
      actionIcon: 'box',
      actionVariant: 'primary',
      onAction: open,
    };
  }

  if (result.kind === 'otherMove') {
    return {
      icon: 'arrow-right-left',
      iconWash: colors.infoWash,
      iconColor: colors.info,
      title: `This box is in "${result.moveName}"`,
      body: 'You have access to that move. Want to jump over to it?',
      actionLabel: 'Jump to it',
      actionIcon: 'corner-up-right',
      actionVariant: 'primary',
      onAction: () => jumpToMove(result.moveId, result.boxId),
    };
  }

  if (result.kind === 'noAccess') {
    return {
      icon: 'lock',
      iconWash: palette.cream200,
      iconColor: palette.ink500,
      title: "You don't have access to this box",
      body: 'Ask the owner to invite you, then scan it again.',
      actionLabel: 'Scan again',
      actionIcon: 'scan-line',
      actionVariant: 'secondary',
      onAction: rescan,
    };
  }

  return {
    icon: 'help-circle',
    iconWash: colors.warningWash,
    iconColor: colors.warning,
    title: "That code isn't part of this move",
    body: "Double-check you're scanning a Tuck label, then try again.",
    actionLabel: 'Scan again',
    actionIcon: 'scan-line',
    actionVariant: 'secondary',
    onAction: rescan,
  };
}

const VIEWFINDER_BG = '#111312';
const GREEN = palette.green400;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: VIEWFINDER_BG },
  loading: { flex: 1, backgroundColor: colors.surfaceApp },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(13,15,14,0.45)' },
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
    backgroundColor: 'rgba(255,255,255,0.16)',
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
    color: 'rgba(255,255,255,0.72)',
    fontFamily: fonts.body.bold,
    fontSize: 14,
  },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.white,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingTop: space[5] + 2,
    paddingHorizontal: space[4] + 2,
    paddingBottom: space[8] + 2,
    ...shadow.xl,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: palette.sand400,
    alignSelf: 'center',
    marginBottom: space[4],
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3] + 2,
  },
  resultIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCopy: { flex: 1 },
  sheetTitle: {
    fontFamily: fonts.display.bold,
    fontSize: 18,
    color: palette.ink900,
    lineHeight: 22,
  },
  sheetBody: {
    fontFamily: fonts.body.semibold,
    fontSize: 13,
    color: palette.ink500,
    lineHeight: 19,
    marginTop: 3,
  },
  sheetActions: {
    marginTop: space[4] + 2,
    gap: space[3],
  },
  rescanLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
  },
  rescanText: {
    fontFamily: fonts.body.bold,
    fontSize: 14,
    color: palette.ink500,
  },

  permSafe: { flex: 1, backgroundColor: colors.surfaceApp },
  permContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space[6],
    gap: space[3],
  },
  permIconWrap: {
    width: 96,
    height: 96,
    borderRadius: radius['2xl'],
    backgroundColor: colors.brandWash,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2],
  },
  permTitle: {
    fontFamily: fonts.display.bold,
    fontSize: 24,
    color: palette.ink900,
    textAlign: 'center',
  },
  permBody: {
    fontFamily: fonts.body.semibold,
    fontSize: 15,
    color: palette.ink500,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: space[3],
    paddingHorizontal: space[2],
  },
  permHint: {
    fontFamily: fonts.body.semibold,
    fontSize: 13,
    color: palette.ink400,
    textAlign: 'center',
    marginTop: space[2],
  },

  pressed: { opacity: 0.7 },
});
