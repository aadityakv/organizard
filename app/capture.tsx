// Free single-item capture — the nav "Capture" verb (Claude Design "Streaming Mode
// Prototype"). Dark camera: snap one item, then name it, one at a time. Everyone gets
// this. A "Switch to Stream" pill is the Pro upsell — free users see the upsell sheet,
// Pro users drop into the streaming session.
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { Button, Icon, Sheet, StreamUpsell } from '@/components';
import { persistCapture } from '@/lib/photos';
import { isProNow, useStore } from '@/store/useStore';
import { boxColor, colors, fonts, palette } from '@/theme';

export default function Capture() {
  const boxes = useStore((s) => s.boxes);
  const isPro = useStore(isProNow);
  const startProTrial = useStore((s) => s.startProTrial);

  const [boxId, setBoxId] = useState<string>(boxes[boxes.length - 1]?.id ?? '');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const [torch, setTorch] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const flashTmo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();

  useEffect(() => {
    if (!camPerm?.granted && camPerm?.canAskAgain) void requestCamPerm();
  }, [camPerm?.granted, camPerm?.canAskAgain, requestCamPerm]);
  useEffect(() => () => { if (flashTmo.current) clearTimeout(flashTmo.current); }, []);

  const box = boxes.find((b) => b.id === boxId) ?? boxes[boxes.length - 1];

  // No boxes yet — can't capture into anything.
  if (!box) {
    return (
      <SafeAreaView style={styles.emptySafe} edges={['top']}>
        <View style={styles.topBarLight}>
          <Pressable onPress={() => router.back()} style={styles.iconBtnLight}><Icon name="x" size={20} color={palette.ink700} /></Pressable>
        </View>
        <View style={styles.empty}>
          <Icon name="package" size={32} color={palette.ink400} />
          <Text style={styles.emptyText}>No boxes yet — add a box first, then capture into it.</Text>
          <Button onPress={() => router.back()}>Back</Button>
        </View>
      </SafeAreaView>
    );
  }

  // Snap one item, then name it in the Add-item form (one at a time, no wall).
  const onShutter = async () => {
    // No camera yet — open the form; it has its own photo + permission UI.
    if (!camPerm?.granted) { router.push({ pathname: '/add-item', params: { boxId: box.id } }); return; }
    setFlash(true);
    if (flashTmo.current) clearTimeout(flashTmo.current);
    flashTmo.current = setTimeout(() => setFlash(false), 200);
    let photo: string | null = null;
    try {
      const pic = await cameraRef.current?.takePictureAsync({ quality: 0.6 });
      if (pic?.uri) photo = await persistCapture(pic.uri);
    } catch (e) {
      console.warn('capture: photo failed', e); // still let them name the item
    }
    router.push({ pathname: '/add-item', params: photo ? { boxId: box.id, photo } : { boxId: box.id } });
  };

  const onSwitchToStream = () => {
    if (isPro) router.push(`/stream/${box.id}`);
    else setUpsellOpen(true);
  };

  return (
    <View style={styles.root}>
      {camPerm?.granted ? (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} />
      ) : null}
      {camPerm?.granted ? <View style={styles.scrim} /> : null}

      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Close" style={styles.iconBtn}>
            <Icon name="x" size={19} color="#fff" />
          </Pressable>
          <Pressable onPress={() => setPickerOpen(true)} style={styles.boxChip}>
            <View style={[styles.dot, { backgroundColor: boxColor(box.color) }]} />
            <Text style={styles.boxChipText} numberOfLines={1}>Box #{box.number} · {box.name}</Text>
            <Icon name="chevron-down" size={15} color="rgba(255,255,255,0.8)" />
          </Pressable>
          <Pressable
            onPress={() => setTorch((t) => !t)}
            accessibilityLabel={torch ? 'Flash on' : 'Flash off'}
            style={[styles.iconBtn, torch && styles.iconBtnOn]}
          >
            <Icon name="zap" size={17} color={torch ? palette.ink900 : '#fff'} />
          </Pressable>
        </View>

        {/* switch to stream — the Pro upsell */}
        <View style={styles.pillWrap}>
          <Pressable onPress={onSwitchToStream} style={styles.streamPill} accessibilityLabel="Switch to Stream">
            <Icon name="zap" size={17} color={colors.brand} />
            <Text style={styles.streamPillText}>Switch to Stream</Text>
            {!isPro ? <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View> : null}
            <Icon name="chevron-right" size={16} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>

        {/* viewfinder */}
        <View style={styles.viewfinder}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <Text style={styles.hint}>Snap an item, then name it</Text>
        </View>

        {/* shutter */}
        <View style={styles.bottom}>
          <Pressable onPress={onShutter} style={styles.shutter} accessibilityLabel="Capture">
            <Icon name="camera" size={30} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>

      {flash ? <View style={styles.flashOverlay} /> : null}

      {/* box picker */}
      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Capture into which box?">
        <View style={{ gap: 6 }}>
          {boxes.map((b) => (
            <Pressable key={b.id} onPress={() => { setBoxId(b.id); setPickerOpen(false); }} style={[styles.pickRow, b.id === box.id && { backgroundColor: palette.green50 }]}>
              <View style={[styles.pickRail, { backgroundColor: boxColor(b.color) }]} />
              <Text style={styles.pickLabel} numberOfLines={1}>#{b.number} {b.name}</Text>
              {b.id === box.id ? <Icon name="check" size={18} color={colors.success} /> : null}
            </Pressable>
          ))}
        </View>
      </Sheet>

      {/* stream upsell */}
      <StreamUpsell
        visible={upsellOpen}
        onClose={() => setUpsellOpen(false)}
        onTryPro={() => { startProTrial(); setUpsellOpen(false); router.push(`/stream/${box.id}`); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#161817' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,22,21,0.32)' },
  safe: { flex: 1 },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  iconBtnOn: { backgroundColor: palette.amber400 },
  boxChip: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)', maxWidth: 240, flexShrink: 1 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  boxChipText: { color: '#fff', fontFamily: fonts.body.bold, fontSize: 13.5, flexShrink: 1 },

  pillWrap: { alignItems: 'center', marginTop: 12, paddingHorizontal: 16 },
  streamPill: { flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'stretch', justifyContent: 'center', height: 44, paddingHorizontal: 18, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', maxWidth: 360 },
  streamPillText: { color: '#fff', fontFamily: fonts.body.extra, fontSize: 14.5 },
  proBadge: { backgroundColor: palette.amber400, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  proBadgeText: { fontSize: 10, fontFamily: fonts.body.extra, color: palette.ink900, letterSpacing: 0.3 },

  viewfinder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 40 },
  frame: { width: 200, height: 200 },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: 'rgba(255,255,255,0.85)' },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 14 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 14 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 14 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 14 },
  hint: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.body.bold, fontSize: 13, textAlign: 'center' },

  bottom: { alignItems: 'center', paddingBottom: 34, paddingTop: 8 },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 5, borderColor: 'rgba(255,255,255,0.85)', backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  flashOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', opacity: 0.85 },

  // box picker
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: palette.cream100, minHeight: 48 },
  pickRail: { width: 14, height: 32, borderRadius: 7 },
  pickLabel: { flex: 1, fontFamily: fonts.body.extra, fontSize: 14.5, color: palette.ink900 },

  // empty state
  emptySafe: { flex: 1, backgroundColor: palette.cream100 },
  topBarLight: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8 },
  iconBtnLight: { width: 38, height: 38, borderRadius: 19, backgroundColor: palette.cream200, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 },
  emptyText: { fontFamily: fonts.body.semibold, fontSize: 14, color: palette.ink500, textAlign: 'center', lineHeight: 20 },
});
