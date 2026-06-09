// Add item — form-first, photo optional.
// Modal route. params: { boxId }. The highest-frequency flow in the app.
// Leads with the item form; a photo can be captured inline but is never required.
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  InputAccessoryView,
  Platform,
  Linking,
  Image,
  Alert,
  type LayoutAnimationConfig,
  LayoutAnimation,
  UIManager,
} from 'react-native';

// iOS keyboard "Done" bar — lets you dismiss the keyboard (which otherwise covers
// Save) from fields that have no usable return key (number pad, multiline notes).
const KBD_ACCESSORY_ID = 'add-item-kbd';
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
} from '@/components';
import {
  useStore,
  boxById,
  currentRole,
  markerById,
} from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { PERM } from '@/lib/permissions';
import { photoSource, persistCapture } from '@/lib/photos';
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

// A single photo in the strip: framed thumbnail, a clear "Cover" label on the
// first one, and an obvious remove button. Falls back to a placeholder glyph if
// the image can't load (e.g. a not-yet-resolved server photo) so the tile never
// renders as floating badges over a blank box.
function PhotoThumb({
  photoRef,
  session,
  isCover,
  onRemove,
}: {
  photoRef: string;
  session: string | null;
  isCover: boolean;
  onRemove: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.thumbWrap}>
      {failed ? (
        <View style={[styles.thumbImg, styles.thumbFailed]}>
          <Icon name="image-off" size={22} color={palette.ink400} />
        </View>
      ) : (
        <Image
          source={photoSource(photoRef, session)}
          style={styles.thumbImg}
          onError={() => setFailed(true)}
        />
      )}
      {isCover ? (
        <View style={styles.coverBadge}>
          <Text style={styles.coverBadgeText}>Cover</Text>
        </View>
      ) : null}
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel="Remove photo"
        hitSlop={10}
        style={({ pressed }) => [styles.thumbRemove, pressed && styles.thumbRemovePressed]}
      >
        <Icon name="x" size={16} color={palette.white} />
      </Pressable>
    </View>
  );
}

export default function AddItem() {
  const { boxId, itemId } = useLocalSearchParams<{ boxId: string; itemId?: string }>();
  const isEdit = !!itemId;

  // ── Store: box context, markers, role, the add action ──────────────────────
  const box = useStore((s) => (boxId ? boxById(s, boxId) : undefined));
  const role = useStore(currentRole);
  const allMarkers = useStore((s) => s.markers);
  const boxMarkerDefs = useStore(
    useShallow((s) => (box?.markers ?? []).map((id) => markerById(s, id)).filter((m): m is NonNullable<typeof m> => Boolean(m))),
  );
  const addItem = useStore((s) => s.addItem);
  const session = useStore((s) => s.session);

  // ── Edit mode: the item being edited + actions and the move picker ──────────
  const editing = useStore((s) =>
    itemId ? (s.itemsByBox[boxId] ?? []).find((it) => it.id === itemId) : undefined,
  );
  const boxes = useStore((s) => s.boxes);
  const updateItem = useStore((s) => s.updateItem);
  const deleteItem = useStore((s) => s.deleteItem);
  const moveItem = useStore((s) => s.moveItem);

  const canEdit = PERM.canEdit(role);

  // ── Camera ─────────────────────────────────────────────────────────────────
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [capturing, setCapturing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  // ── Form state ───────────────────────────────────────────────────────────--
  const [photos, setPhotos] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [selectedMarkers, setSelectedMarkers] = useState<string[]>([]);
  const [addedCount, setAddedCount] = useState(0);
  // Destination box for the move picker (edit mode). Defaults to the current box.
  const [targetBoxId, setTargetBoxId] = useState(boxId);

  // ── One-time prefill when editing ────────────────────────────────────────────
  const prefilled = useRef(false);
  useEffect(() => {
    if (!itemId || !editing || prefilled.current) return;
    prefilled.current = true;
    setName(editing.name);
    setValue(editing.value ? String(editing.value) : '');
    setQty(editing.qty);
    setNote(editing.note ?? '');
    setSelectedMarkers(editing.markers ?? []);
    setPhotos(editing.photos ?? []);
    setTargetBoxId(boxId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

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

  // Open the inline camera card. If the user hasn't granted access yet, ask —
  // and whatever the outcome, surface the card so they see the inline prompt.
  const openCamera = async () => {
    if (!permissionGranted) {
      const res = await requestPermission();
      if (!res?.granted) {
        setCameraOpen(true);
        return;
      }
    }
    setCameraOpen(true);
  };

  const removePhoto = (uri: string, index: number) => {
    LayoutAnimation.configureNext(FLASH_CONFIG);
    setPhotos((prev) => prev.filter((p, i) => !(p === uri && i === index)));
  };

  const capture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      if (pic?.uri) {
        const ref = await persistCapture(pic.uri); // copy to doc dir → stable `local:` ref
        LayoutAnimation.configureNext(FLASH_CONFIG);
        setPhotos((prev) => [...prev, ref]);
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

  // Edit mode: persist the patch, then move the (already-edited) item if needed.
  const saveEdit = () => {
    if (!boxId || !itemId || !canEdit) return;
    updateItem(boxId, itemId, {
      name: name.trim() || 'Untitled item',
      qty,
      value: parsedValue,
      note: note.trim() || undefined,
      markers: selectedMarkers,
      photos,
    });
    if (targetBoxId !== boxId) {
      moveItem(boxId, targetBoxId, itemId);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    close();
  };

  const confirmDelete = () => {
    if (!boxId || !itemId) return;
    Alert.alert(
      `Delete "${name.trim() || 'this item'}"?`,
      "This removes the item from the box. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteItem(boxId, itemId);
            close();
          },
        },
      ],
    );
  };

  // ── Box subtitle line (header) ───────────────────────────────────────────────
  const boxLabel = box
    ? isEdit
      ? `Edit item · Box #${box.number}`
      : `Box #${box.number} · ${box.name}`
    : isEdit
      ? 'Edit item'
      : 'Add to your box';

  const permissionGranted = permission?.granted ?? false;
  const permissionDenied = permission != null && !permission.granted && !permission.canAskAgain;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Top bar: close · box label ────────────────────────────────────── */}
        <View style={styles.topBar}>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            style={({ pressed }) => [styles.topBtn, pressed && styles.topBtnPressed]}
          >
            <Icon name="x" size={22} color={colors.textBody} />
          </Pressable>

          <View style={styles.boxTag}>
            <View style={[styles.boxTagDot, { backgroundColor: boxColor(hueName) }]} />
            <Text numberOfLines={1} style={styles.boxTagLabel}>
              {boxLabel}
            </Text>
          </View>

          {/* spacer to keep the label visually centered against the close button */}
          <View style={styles.topBtnSpacer} />
        </View>

        {/* ── Form (primary content) ────────────────────────────────────────── */}
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
            // Only pop the keyboard when CREATING a new item. When editing an
            // existing one you're usually just glancing/tweaking — don't hijack focus.
            autoFocus={!isEdit}
          />

          <View style={styles.fieldRow}>
            <Input
              label="Value"
              value={value}
              onChangeText={setValue}
              placeholder="0"
              keyboardType="decimal-pad"
              prefix="$"
              inputAccessoryViewID={Platform.OS === 'ios' ? KBD_ACCESSORY_ID : undefined}
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
            inputAccessoryViewID={Platform.OS === 'ios' ? KBD_ACCESSORY_ID : undefined}
            multiline
          />

          {/* ── Photos (optional, collapsed by default) ───────────────────── */}
          <View style={styles.photoSection}>
            <Text style={styles.sectionHeading}>Photos (optional)</Text>

            {photos.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.stripContent}
                keyboardShouldPersistTaps="handled"
              >
                {photos.map((ref, i) => (
                  <PhotoThumb
                    key={`${ref}-${i}`}
                    photoRef={ref}
                    session={session}
                    isCover={i === 0}
                    onRemove={() => removePhoto(ref, i)}
                  />
                ))}
              </ScrollView>
            ) : null}

            {/* ── Inline camera card ──────────────────────────────────────── */}
            {cameraOpen ? (
              <View style={styles.cameraCard}>
                {permissionGranted ? (
                  <>
                    <CameraView
                      ref={cameraRef}
                      style={StyleSheet.absoluteFill}
                      facing="back"
                      enableTorch={flash === 'on'}
                    />
                    {/* dim wash so the controls stay legible over any scene */}
                    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cameraScrim]} />

                    <View style={styles.cameraControls}>
                      <Pressable
                        onPress={() => setFlash((f) => (f === 'on' ? 'off' : 'on'))}
                        accessibilityRole="button"
                        accessibilityLabel={flash === 'on' ? 'Turn flash off' : 'Turn flash on'}
                        hitSlop={8}
                        style={({ pressed }) => [
                          styles.glassBtn,
                          flash === 'on' && styles.glassBtnActive,
                          pressed && styles.glassBtnPressed,
                        ]}
                      >
                        <Icon name={flash === 'on' ? 'zap' : 'zap-off'} size={18} color={palette.white} />
                      </Pressable>

                      <Pressable
                        onPress={capture}
                        disabled={capturing}
                        accessibilityRole="button"
                        accessibilityLabel="Capture photo"
                        style={({ pressed }) => [
                          styles.shutter,
                          pressed && styles.shutterPressed,
                          capturing && styles.shutterDim,
                        ]}
                      >
                        <Icon name="camera" size={24} color={palette.white} />
                      </Pressable>

                      <Pressable
                        onPress={() => setCameraOpen(false)}
                        accessibilityRole="button"
                        accessibilityLabel="Done taking photos"
                        hitSlop={8}
                        style={({ pressed }) => [
                          styles.glassBtn,
                          pressed && styles.glassBtnPressed,
                        ]}
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
                          Turn it on in settings to snap a photo as you pack. You can still add the
                          item with just its details.
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
                          A quick picture makes items easy to spot later — but it's optional. Save
                          without one anytime.
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
                      onPress={() => setCameraOpen(false)}
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
            ) : (
              <Pressable
                onPress={openCamera}
                accessibilityRole="button"
                accessibilityLabel={photos.length === 0 ? 'Add photo' : 'Add another photo'}
                style={({ pressed }) => [styles.addPhotoBtn, pressed && styles.addPhotoBtnPressed]}
              >
                <Icon name={photos.length === 0 ? 'camera' : 'plus'} size={18} color={colors.brand} />
                <Text style={styles.addPhotoText}>
                  {photos.length === 0 ? 'Add photo (optional)' : 'Add another photo'}
                </Text>
              </Pressable>
            )}
          </View>

          {markerChoices.length > 0 ? (
            <View style={styles.markerSection}>
              <Text style={styles.sectionHeading}>Markers (optional)</Text>
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

          {/* ── Move to box + delete (edit mode only) ─────────────────────── */}
          {isEdit && canEdit ? (
            <>
              {boxes.length > 1 ? (
                <View style={styles.markerSection}>
                  <Text style={styles.sectionHeading}>Move to box</Text>
                  <View style={styles.markerWrap}>
                    {boxes.map((b) => {
                      const on = b.id === targetBoxId;
                      return (
                        <Pressable
                          key={b.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          onPress={() => setTargetBoxId(b.id)}
                          style={({ pressed }) => [
                            styles.boxChip,
                            on && styles.boxChipOn,
                            pressed && styles.boxChipPressed,
                          ]}
                        >
                          <View style={[styles.boxChipBadge, { backgroundColor: boxColor(b.color) }]}>
                            <Text style={styles.boxChipBadgeText}>#{b.number}</Text>
                          </View>
                          <Text
                            style={[styles.boxChipText, on && styles.boxChipTextOn]}
                            numberOfLines={1}
                          >
                            {b.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <Pressable
                onPress={confirmDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete item"
                style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
              >
                <Icon name="trash-2" size={18} color={colors.danger} />
                <Text style={styles.deleteText}>Delete item</Text>
              </Pressable>
            </>
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
            isEdit ? (
              <Button variant="primary" size="lg" fullWidth onPress={saveEdit}>
                Save changes
              </Button>
            ) : (
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
            )
          ) : (
            <LockNote>You can view and scan, but only an editor can add items.</LockNote>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* iOS-only keyboard accessory: a Done button above the keyboard so the notes /
          value keyboard can be dismissed to reach Save. */}
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={KBD_ACCESSORY_ID}>
          <View style={styles.kbdBar}>
            <Pressable
              onPress={() => Keyboard.dismiss()}
              accessibilityRole="button"
              accessibilityLabel="Done"
              hitSlop={8}
              style={({ pressed }) => [styles.kbdDone, pressed && styles.kbdDonePressed]}
            >
              <Text style={styles.kbdDoneText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </SafeAreaView>
  );
}

const CAMERA_CARD_H = 240;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceApp,
  },
  flex: {
    flex: 1,
  },

  // ── Top bar ──────────────────────────────────────────────────────────────--
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingVertical: space[2],
    gap: space[2],
    backgroundColor: colors.surfaceApp,
    borderBottomWidth: 1,
    borderBottomColor: palette.sand300,
  },
  topBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: palette.cream200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },
  topBtnSpacer: {
    width: 38,
    height: 38,
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
    color: colors.textStrong,
    flexShrink: 1,
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

  // ── Section headings (Photos / Markers) ─────────────────────────────────────
  sectionHeading: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: colors.textBody,
  },

  // ── Photos ─────────────────────────────────────────────────────────────────
  photoSection: {
    gap: space[2],
  },
  stripContent: {
    gap: space[2],
    alignItems: 'center',
    paddingRight: space[1],
    paddingTop: 5,
    paddingHorizontal: 5,
  },
  thumbWrap: {
    position: 'relative',
    paddingTop: 8,
    paddingRight: 8,
  },
  thumbImg: {
    width: 76,
    height: 76,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.sand300,
    backgroundColor: palette.cream100,
  },
  thumbFailed: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cream200,
  },
  coverBadge: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(20,22,21,0.62)',
  },
  coverBadgeText: {
    fontFamily: fonts.body.extra,
    fontSize: 9.5,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: palette.white,
  },
  thumbRemove: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  thumbRemovePressed: {
    opacity: 0.8,
    transform: [{ scale: 0.9 }],
  },

  // ── Add-photo button (ghost affordance) ─────────────────────────────────────
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.green200,
    backgroundColor: colors.brandWash,
  },
  addPhotoBtnPressed: {
    opacity: 0.8,
    backgroundColor: palette.green100,
  },
  addPhotoText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.base,
    color: colors.brandPressed,
  },

  // ── Inline camera card ──────────────────────────────────────────────────────
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

  // ── Permission states (inside the camera card) ──────────────────────────────
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

  // ── Markers ──────────────────────────────────────────────────────────────--
  markerSection: {
    gap: space[2],
  },
  markerWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },

  // ── Move-to-box chips (edit mode) ───────────────────────────────────────────
  boxChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 40,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.sand300,
    backgroundColor: palette.white,
  },
  boxChipOn: {
    borderColor: colors.brand,
    backgroundColor: palette.green50,
  },
  boxChipPressed: {
    opacity: 0.8,
  },
  boxChipBadge: {
    minWidth: 30,
    height: 28,
    paddingHorizontal: 7,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChipBadgeText: {
    fontFamily: fonts.body.extra,
    fontSize: 11,
    color: palette.white,
  },
  boxChipText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.sm,
    color: colors.textBody,
    maxWidth: 140,
  },
  boxChipTextOn: {
    color: palette.green700,
  },

  // ── Delete item (edit mode) ─────────────────────────────────────────────────
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    marginTop: space[1],
  },
  deleteBtnPressed: {
    opacity: 0.7,
  },
  deleteText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.base,
    color: colors.danger,
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

  // Keyboard "Done" accessory bar
  kbdBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: palette.cream100,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.sand300,
    paddingHorizontal: gutter,
    paddingVertical: space[1] + 2,
  },
  kbdDone: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  kbdDonePressed: { opacity: 0.6 },
  kbdDoneText: {
    fontFamily: fonts.body.bold,
    fontSize: fontSize.base,
    color: colors.brand,
  },
});
