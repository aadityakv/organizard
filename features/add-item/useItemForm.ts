// The Add / Edit item form: store context for the box, the field state, and the
// save / save-and-add-another / edit / move / delete actions.
import { useEffect, useRef, useState } from 'react';
import { Alert, LayoutAnimation } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import { PERM } from '@/lib/permissions';
import { boxById, currentRole, markerById, useStore } from '@/store/useStore';

import { FLASH_CONFIG } from './constants';

export function useItemForm({ boxId, itemId, photo }: { boxId: string; itemId?: string; photo?: string }) {
  const isEdit = !!itemId;

  // ── Store: box context, markers, role, the add action ──────────────────────
  const box = useStore((s) => (boxId ? boxById(s, boxId) : undefined));
  const role = useStore(currentRole);
  const allMarkers = useStore((s) => s.markers);
  const boxMarkerDefs = useStore(
    useShallow((s) =>
      (box?.markers ?? [])
        .map((id) => markerById(s, id))
        .filter((m): m is NonNullable<typeof m> => Boolean(m)),
    ),
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

  // Prefill a photo captured in the quick single-capture flow (create mode only).
  const photoPrefilled = useRef(false);
  useEffect(() => {
    if (isEdit || !photo || photoPrefilled.current) return;
    photoPrefilled.current = true;
    setPhotos((prev) => (prev.length ? prev : [photo]));
  }, [isEdit, photo]);

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
    setSelectedMarkers((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  };

  const addPhoto = (ref: string) => setPhotos((prev) => [...prev, ref]);

  const removePhoto = (uri: string, index: number) => {
    LayoutAnimation.configureNext(FLASH_CONFIG);
    setPhotos((prev) => prev.filter((p, i) => !(p === uri && i === index)));
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

  return {
    isEdit,
    canEdit,
    box,
    boxLabel,
    hueName: box?.color ?? 'green',
    boxes,
    session,
    markerChoices,
    name,
    setName,
    value,
    setValue,
    qty,
    setQty,
    note,
    setNote,
    parsedValue,
    selectedMarkers,
    toggleMarker,
    photos,
    addPhoto,
    removePhoto,
    targetBoxId,
    setTargetBoxId,
    addedCount,
    close,
    save,
    saveEdit,
    confirmDelete,
  };
}
