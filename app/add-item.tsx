// Add item — camera-first, optimized for rapid back-to-back capture.
// Modal route. params: { boxId }. The highest-frequency flow in the app.
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Image,
  type LayoutAnimationConfig,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';

import {
  Button,
  Input,
  Stepper,
  MarkerChip,
  LockNote,
  Icon,
  Thumb,
} from '@/components';
import {
  useStore,
  boxById,
  currentRole,
  markerById,
} from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { PERM } from '@/lib/permissions';
import {
  colors,
  palette,
  space,
  gutter,
  radius,
  shadow,
  fonts,
  fontSize,
  boxColor,
} from '@/theme';

// A friendly press animation for the captured layout when photos arrive.
const FLASH_CONFIG: LayoutAnimationConfig = LayoutAnimation.create(
  180,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity,
);

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AddItem() {
  const { boxId } = useLocalSearchParams<{ boxId: string }>();

  // ── Store: box context, markers, role, the add action ──────────────────────
  const box = useStore((s) => (boxId ? boxById(s, boxId) : undefined));
  const role = useStore(currentRole);
  const allMarkers = useStore((s) => s.markers);
  const boxMarkerDefs = useStore(
    useShallow((s) => (box?.markers ?? []).map((id) => markerById(s, id)).filter((m): m is NonNullable<typeof m> => Boolean(m))),
  );
  const addItem = useStore((s) => s.addItem);

  const canEdit = PERM.canEdit(role);

  // ── Camera ─────────────────────────────────────────────────────────────────
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [capturing, setCapturing] = useState(false);

  // ── Form state ───────────────────────────────────────────────────────────--
  const [photos, setPhotos] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [selectedMarkers, setSelectedMarkers] = useState<string[]>([]);
  const [addedCount, setAddedCount] = useState(0);

  const hueName = box?.color ?? 'green';

  // Which marker chips to show: the box's own markers first, else the full set
  // so a Viewer-less owner can still tag the item meaningfully.
  const markerChoices = boxMarkerDefs.length > 0 ? boxMarkerDefs : allMarkers;

  // ── Actions ────────────────────────────────────────────────────────────────
  const resetForm = () => {
    setPhotos([]);
    setName('');
    setValue('');
    setQty(1);
    setNote('');
    setSelectedMarkers([]);
  };

  const close = () => router.back();

  const toggleMarker = (id: string) => {
    setSelectedMarkers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const capture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      if (pic?.uri) {
        LayoutAnimation.configureNext(FLASH_CONFIG);
        setPhotos((prev) => [...prev, pic.uri]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    } catch {
      // capture can fail if the camera is mid-teardown — keep the UI calm.
    } finally {
      setCapturing(false);
    }
  };

  const parsedValue = (() => {
    const n = Number(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  })();

  const save = (another: boolean) => {
    if (!boxId || !canEdit) return;
    const trimmedName = name.trim();
    addItem(boxId, {
      name: trimmedName.length > 0 ? trimmedName : 'Untitled item',
      qty,
      value: parsedValue,
      note: note.trim() || undefined,
      photos,
      markers: selectedMarkers,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (another) {
      setAddedCount((c) => c + 1);
      resetForm();
    } else {
      close();
    }
  };

  // ── Box subtitle line (header inside the dark viewfinder) ────────────────────
  const boxLabel = box ? `Box #${box.number} · ${box.name}` : 'Add to your box';

  const permissionGranted = permission?.granted ?? false;
  const permissionDenied = permission != null && !permission.granted && !permission.canAskAgain;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Camera viewfinder ─────────────────────────────────────────────── */}
        <View style={styles.viewfinder}>
          {permissionGranted ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={flash === 'on'}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.viewfinderFallbackBg]} />
          )}

          {/* dim wash so chrome stays legible over any scene */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.viewfinderScrim]} />

          {/* top bar: close · box label · flash */}
          <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={({ pressed }) => [styles.glassBtn, pressed && styles.glassBtnPressed]}
            >
              <Icon name="x" size={20} color={palette.white} />
            </Pressable>

            <View style={styles.boxTag}>
              <View style={[styles.boxTagDot, { backgroundColor: boxColor(hueName) }]} />
              <Text numberOfLines={1} style={styles.boxTagLabel}>
                {boxLabel}
              </Text>
            </View>

            <Pressable
              onPress={() => setFlash((f) => (f === 'on' ? 'off' : 'on'))}
              accessibilityRole="button"
              accessibilityLabel={flash === 'on' ? 'Turn flash off' : 'Turn flash on'}
              hitSlop={8}
              disabled={!permissionGranted}
              style={({ pressed }) => [
                styles.glassBtn,
                flash === 'on' && styles.glassBtnActive,
                pressed && styles.glassBtnPressed,
                !permissionGranted && styles.glassBtnDim,
              ]}
            >
              <Icon name={flash === 'on' ? 'zap' : 'zap-off'} size={18} color={palette.white} />
            </Pressable>
          </SafeAreaView>

          {/* center: brackets + prompt, or the permission states */}
          {permissionGranted ? (
            <View pointerEvents="none" style={styles.centerStack}>
              <View style={styles.brackets}>
                <View style={[styles.corner, styles.cornerNW]} />
                <View style={[styles.corner, styles.cornerNE]} />
                <View style={[styles.corner, styles.cornerSW]} />
                <View style={[styles.corner, styles.cornerSE]} />
              </View>
              <Text style={styles.pointText}>Point at your item</Text>
            </View>
          ) : (
            <View style={styles.permStack}>
              <View style={styles.permGlyph}>
                <Icon name="camera" size={26} color={palette.white} />
              </View>
              {permission == null ? (
                <Text style={styles.permTitle}>Getting the camera ready…</Text>
              ) : permissionDenied ? (
                <>
                  <Text style={styles.permTitle}>Camera access is off</Text>
                  <Text style={styles.permBody}>
                    Turn it on in settings to snap a photo as you pack. You can still add the item
                    with just its details.
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
                    A quick picture makes every item easy to spot later. Mind sharing your camera?
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
            </View>
          )}
        </View>

        {/* ── Captured strip + shutter ──────────────────────────────────────── */}
        <View style={styles.captureRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stripContent}
            style={styles.strip}
            keyboardShouldPersistTaps="handled"
          >
            {photos.map((uri, i) => (
              <View key={`${uri}-${i}`} style={styles.thumbWrap}>
                <Image source={{ uri }} style={styles.thumbImg} />
                {i === 0 ? (
                  <View style={styles.coverBadge}>
                    <Text style={styles.coverBadgeText}>1</Text>
                  </View>
                ) : null}
              </View>
            ))}

            {photos.length === 0 ? (
              <View style={styles.thumbWrap}>
                <Thumb color={hueName} icon="image" size={48} />
              </View>
            ) : null}
          </ScrollView>

          <Pressable
            onPress={capture}
            disabled={!permissionGranted || capturing}
            accessibilityRole="button"
            accessibilityLabel="Capture photo"
            style={({ pressed }) => [
              styles.shutter,
              pressed && styles.shutterPressed,
              (!permissionGranted || capturing) && styles.shutterDim,
            ]}
          >
            <Icon name="camera" size={24} color={palette.white} />
          </Pressable>
        </View>

        {/* ── Form ──────────────────────────────────────────────────────────── */}
        <ScrollView
          style={styles.form}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <Input
            label="Item name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Cast iron skillet"
            autoFocus
          />

          <View style={styles.fieldRow}>
            <Input
              label="Value"
              value={value}
              onChangeText={setValue}
              placeholder="0"
              keyboardType="decimal-pad"
              prefix="$"
              style={styles.valueField}
            />
            <View style={styles.qtyField}>
              <Text style={styles.qtyLabel}>Quantity</Text>
              <View style={styles.qtyBox}>
                <Stepper value={qty} onChange={setQty} />
              </View>
            </View>
          </View>

          <Input
            label="Notes (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="Fragile, which towel it's wrapped in…"
            multiline
          />

          {markerChoices.length > 0 ? (
            <View style={styles.markerSection}>
              <Text style={styles.markerHeading}>Markers (optional)</Text>
              <View style={styles.markerWrap}>
                {markerChoices.map((m) => (
                  <MarkerChip
                    key={m.id}
                    label={m.label}
                    color={m.color}
                    icon={m.icon}
                    selected={selectedMarkers.includes(m.id)}
                    onPress={() => toggleMarker(m.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>

        {/* ── Bottom actions ────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          {addedCount > 0 ? (
            <View style={styles.addedRow}>
              <Icon name="check-circle-2" size={16} color={colors.success} />
              <Text style={styles.addedText}>
                Added {addedCount} {addedCount === 1 ? 'item' : 'items'} to this box
              </Text>
            </View>
          ) : null}

          {canEdit ? (
            <View style={styles.actionRow}>
              <Button
                variant="secondary"
                size="lg"
                onPress={() => save(false)}
                style={styles.saveBtn}
              >
                Save
              </Button>
              <Button
                variant="primary"
                size="lg"
                iconLeft="plus"
                onPress={() => save(true)}
                style={styles.saveAnotherBtn}
              >
                Save & add another
              </Button>
            </View>
          ) : (
            <LockNote>You can view and scan, but only an editor can add items.</LockNote>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const VIEWFINDER_H = 286;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceApp,
  },
  flex: {
    flex: 1,
  },

  // ── Viewfinder ─────────────────────────────────────────────────────────────
  viewfinder: {
    height: VIEWFINDER_H,
    backgroundColor: '#1B1D1C',
    overflow: 'hidden',
    flexShrink: 0,
  },
  viewfinderFallbackBg: {
    backgroundColor: '#1B1D1C',
  },
  viewfinderScrim: {
    backgroundColor: 'rgba(20,22,21,0.28)',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingTop: space[2],
    gap: space[2],
    zIndex: 2,
  },
  glassBtn: {
    width: 38,
    height: 38,
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
  glassBtnDim: {
    opacity: 0.4,
  },
  boxTag: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  boxTagDot: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
  },
  boxTagLabel: {
    fontFamily: fonts.body.bold,
    fontSize: 13.5,
    color: palette.white,
    flexShrink: 1,
  },

  centerStack: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
  },
  brackets: {
    width: 150,
    height: 150,
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  cornerNW: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  cornerNE: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  cornerSW: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  cornerSE: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  pointText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
  },

  // ── Permission states (over the dark viewfinder) ────────────────────────────
  permStack: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[8],
    paddingTop: space[12],
    gap: space[2],
  },
  permGlyph: {
    width: 52,
    height: 52,
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

  // ── Capture strip + shutter ─────────────────────────────────────────────────
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: gutter,
    paddingVertical: space[3],
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.sand300,
  },
  strip: {
    flex: 1,
  },
  stripContent: {
    gap: space[2],
    alignItems: 'center',
    paddingRight: space[1],
  },
  thumbWrap: {
    position: 'relative',
  },
  thumbImg: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
  },
  coverBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBadgeText: {
    fontFamily: fonts.body.extra,
    fontSize: 10,
    color: palette.white,
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

  // ── Form ─────────────────────────────────────────────────────────────────--
  form: {
    flex: 1,
  },
  formContent: {
    padding: gutter,
    gap: space[3] + 2,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[3],
  },
  valueField: {
    flex: 1,
  },
  qtyField: {
    gap: 6,
  },
  qtyLabel: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: colors.textBody,
    marginBottom: 6,
  },
  qtyBox: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: space[1] + 2,
    borderWidth: 1.5,
    borderColor: palette.sand300,
    borderRadius: radius.md,
    backgroundColor: palette.white,
  },
  markerSection: {
    gap: space[2],
  },
  markerHeading: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: colors.textBody,
  },
  markerWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: gutter,
    paddingTop: space[3],
    paddingBottom: space[2],
    backgroundColor: colors.surfaceApp,
    borderTopWidth: 1,
    borderTopColor: palette.sand300,
  },
  addedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: space[2] + 2,
  },
  addedText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: colors.success,
  },
  actionRow: {
    flexDirection: 'row',
    gap: space[2] + 2,
  },
  saveBtn: {
    flex: 1,
  },
  saveAnotherBtn: {
    flex: 1.5,
  },
});
