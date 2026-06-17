// Capture entry (the nav center button). A segmented control picks the mode:
//  • Single item — quick one-off: snap a photo, choose which box, add it. Free.
//  • Stream — Pro rapid-capture session (upsell for free users, box picker for Pro).
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';

import { Button, Header, Icon, Segmented, Sheet } from '@/components';
import { persistCapture } from '@/lib/photos';
import { isProNow, useStore } from '@/store/useStore';
import { boxColor, colors, fonts, palette, radius } from '@/theme';

const PERKS: { icon: string; label: string }[] = [
  { icon: 'camera', label: 'Snap a photo and just say what it is' },
  { icon: 'mic', label: 'Or turn photos off and talk a whole box in' },
  { icon: 'badge-check', label: 'Value & quantity parsed from your voice' },
];

type Tab = 'single' | 'stream';

export default function Capture() {
  const boxes = useStore((s) => s.boxes);
  const isPro = useStore(isProNow);
  const startProTrial = useStore((s) => s.startProTrial);
  const [tab, setTab] = useState<Tab>('single');

  // Single-tab camera + the post-snap "which box?" picker.
  const cameraRef = useRef<CameraView>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pendingPhoto = useRef<string | null>(null); // the just-snapped photo (or null = no photo)

  const noBoxes = boxes.length === 0;
  const camGranted = camPerm?.granted ?? false;
  const camDenied = camPerm != null && !camPerm.granted && !camPerm.canAskAgain;

  // Snap a photo, then ask which box it goes in.
  const snap = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const pic = await cameraRef.current?.takePictureAsync({ quality: 0.6 });
      pendingPhoto.current = pic?.uri ? await persistCapture(pic.uri) : null;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {
      pendingPhoto.current = null; // capture failed — still let them add without a photo
    } finally {
      setCapturing(false);
      setPickerOpen(true);
    }
  };

  // Skip the photo entirely — go straight to the box picker.
  const skipPhoto = () => {
    pendingPhoto.current = null;
    setPickerOpen(true);
  };

  // Box chosen → open Add item with the box (and photo) prefilled.
  const addToBox = (boxId: string) => {
    const photo = pendingPhoto.current;
    pendingPhoto.current = null;
    setPickerOpen(false);
    router.replace({ pathname: '/add-item', params: photo ? { boxId, photo } : { boxId } });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Capture" onBack={() => router.back()} />
      <View style={styles.segWrap}>
        <Segmented
          options={[{ value: 'single', label: 'Single item' }, { value: 'stream', label: 'Stream' }]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          style={styles.seg}
        />
      </View>

      {noBoxes ? (
        <View style={styles.empty}>
          <Icon name="package" size={32} color={palette.ink400} />
          <Text style={styles.emptyText}>No boxes yet — add a box first, then capture into it.</Text>
          <Button onPress={() => router.back()}>Back</Button>
        </View>
      ) : tab === 'single' ? (
        // ── Single item: snap → pick box → quick add ────────────────────────────
        <View style={styles.single}>
          <View style={styles.cameraCard}>
            {camGranted ? (
              <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
            ) : (
              <View style={styles.permStack}>
                <View style={styles.permGlyph}><Icon name="camera" size={24} color="#fff" /></View>
                <Text style={styles.permTitle}>{camDenied ? 'Camera access is off' : 'Snap as you pack'}</Text>
                <Text style={styles.permBody}>
                  {camDenied
                    ? 'Turn it on in Settings to snap a photo as you go — or just add the item without one.'
                    : 'Take a quick photo, then choose which box it goes in. The photo’s optional.'}
                </Text>
                <Button
                  variant="secondary"
                  size="md"
                  iconLeft={camDenied ? 'settings' : 'camera'}
                  onPress={() => (camDenied ? Linking.openSettings() : requestCamPerm())}
                  style={{ marginTop: 8 }}
                >
                  {camDenied ? 'Open settings' : 'Allow camera'}
                </Button>
              </View>
            )}
          </View>

          {camGranted ? (
            <Pressable
              onPress={snap}
              disabled={capturing}
              accessibilityLabel="Capture photo"
              style={({ pressed }) => [styles.shutter, pressed && styles.shutterPressed, capturing && styles.shutterDim]}
            >
              <Icon name="camera" size={28} color="#fff" />
            </Pressable>
          ) : null}

          <Pressable onPress={skipPhoto} style={styles.skip} accessibilityLabel="Add without a photo">
            <Text style={styles.skipText}>Add without a photo</Text>
          </Pressable>
        </View>
      ) : !isPro ? (
        // ── Stream (free): upsell ───────────────────────────────────────────────
        <ScrollView contentContainerStyle={styles.upsell}>
          <View style={styles.tile}><Icon name="zap" size={28} color={palette.green700} /></View>
          <Text style={styles.upTitle}>Pack 10× faster with Stream</Text>
          <Text style={styles.upSub}>Snap or speak item after item — Tuck fills in the name, count and value as you go. Part of Tuck Pro.</Text>
          <View style={styles.perks}>
            {PERKS.map((p) => (
              <View key={p.icon} style={styles.perkRow}>
                <View style={styles.perkIcon}><Icon name={p.icon} size={16} color={palette.green700} /></View>
                <Text style={styles.perkText}>{p.label}</Text>
              </View>
            ))}
          </View>
          <Button fullWidth size="lg" onPress={() => startProTrial()}>Try Pro free for 7 days</Button>
        </ScrollView>
      ) : (
        // ── Stream (Pro): box picker → session ──────────────────────────────────
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.streamHint}>Which box are you packing?</Text>
          {boxes.map((b) => (
            <Pressable key={b.id} onPress={() => router.replace(`/stream/${b.id}`)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <View style={[styles.rail, { backgroundColor: boxColor(b.color) }]} />
              <Text style={styles.label} numberOfLines={1}>#{b.number} {b.name}</Text>
              <Icon name="chevron-right" size={18} color={palette.ink400} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* which box? — after a snap (or skip) in the single flow */}
      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Add to which box?">
        <View style={{ gap: 6 }}>
          {boxes.map((b) => (
            <Pressable key={b.id} onPress={() => addToBox(b.id)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <View style={[styles.rail, { backgroundColor: boxColor(b.color) }]} />
              <Text style={styles.label} numberOfLines={1}>#{b.number} {b.name}</Text>
              <Icon name="chevron-right" size={18} color={palette.ink400} />
            </Pressable>
          ))}
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.cream100 },
  segWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  seg: { alignSelf: 'center' },
  list: { padding: 16, gap: 8 },
  streamHint: { fontFamily: fonts.body.bold, fontSize: 13.5, color: palette.ink500, paddingHorizontal: 2, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.white, borderRadius: radius.lg, padding: 14, minHeight: 56 },
  rowPressed: { backgroundColor: palette.cream200 },
  rail: { width: 14, height: 34, borderRadius: 7 },
  label: { flex: 1, fontFamily: fonts.body.extra, fontSize: 15, color: palette.ink900 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 },
  emptyText: { fontFamily: fonts.body.semibold, fontSize: 14, color: palette.ink500, textAlign: 'center', lineHeight: 20 },

  // single item
  single: { flex: 1, padding: 16, alignItems: 'center' },
  cameraCard: { alignSelf: 'stretch', flex: 1, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#1B1D1C', marginBottom: 16 },
  permStack: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 8 },
  permGlyph: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  permTitle: { fontFamily: fonts.display.semibold, fontSize: 17, color: '#fff', textAlign: 'center' },
  permBody: { fontFamily: fonts.body.semibold, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.72)', textAlign: 'center' },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 5, borderColor: palette.green100, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  shutterPressed: { opacity: 0.9, transform: [{ scale: 0.95 }] },
  shutterDim: { opacity: 0.5 },
  skip: { marginTop: 12, paddingVertical: 6, paddingHorizontal: 12 },
  skipText: { fontFamily: fonts.body.bold, fontSize: 14, color: palette.ink500, textDecorationLine: 'underline' },

  // stream upsell
  upsell: { padding: 24, alignItems: 'center', gap: 10 },
  tile: { width: 56, height: 56, borderRadius: 16, backgroundColor: palette.green50, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  upTitle: { fontFamily: fonts.display.bold, fontSize: 23, color: palette.ink900, textAlign: 'center' },
  upSub: { fontSize: 14, fontFamily: fonts.body.bold, color: palette.ink500, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  perks: { gap: 10, marginVertical: 14, alignSelf: 'stretch' },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  perkIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: palette.green50, alignItems: 'center', justifyContent: 'center' },
  perkText: { fontSize: 13.5, fontFamily: fonts.body.bold, color: palette.ink700, flex: 1 },
});
