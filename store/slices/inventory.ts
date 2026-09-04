// Editing the open move: rooms, boxes, items, statuses, markers, move details.
// Each action updates the live slice and enqueues the matching Mutation; `enqueue`
// itself is a no-op for local moves, so this file never needs to know the mode.
import type { StateCreator } from 'zustand';

import type { Item } from '@/data/types';
import { uid } from '@/lib/uid';
import type { Mutation } from '@/shared';

import { mutation } from '../mutation';
import { isLocalUri } from '../snapshot';
import type { InventoryActions, Store } from '../types';

export type InventorySlice = StateCreator<Store, [['zustand/persist', unknown]], [], InventoryActions>;

/** Actions that edit the open move. */
export const createInventorySlice: InventorySlice = (set, get) => ({
  addRoom: ({ name, dest = null, icon = 'box', color = 'slate' }) => {
    const id = uid('r');
    set((s) => ({ rooms: [...s.rooms, { id, name, dest, icon, color }] }));
    get().enqueue(mutation('addRoom', { id, name, dest, icon, color }));
    return id;
  },

  updateRoom: (id, patch) => {
    set((s) => ({ rooms: s.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
    get().enqueue(mutation('updateRoom', { id, ...patch }));
  },

  deleteRoom: (id) => {
    const boxIds = get()
      .boxes.filter((b) => b.roomId === id)
      .map((b) => b.id);
    set((s) => {
      const itemsByBox = { ...s.itemsByBox };
      for (const bId of boxIds) delete itemsByBox[bId];
      return {
        rooms: s.rooms.filter((r) => r.id !== id),
        boxes: s.boxes.filter((b) => b.roomId !== id),
        itemsByBox,
      };
    });
    for (const bId of boxIds) get().enqueue(mutation('deleteBox', { id: bId }));
    get().enqueue(mutation('deleteRoom', { id }));
  },

  addBox: ({ name, color, roomId, status = 'packing' }) => {
    const id = uid('b');
    const number = get().boxes.reduce((max, b) => Math.max(max, b.number), 0) + 1;
    set((s) => ({
      boxes: [...s.boxes, { id, number, name, color, roomId, status, markers: [], cover: null }],
      itemsByBox: { ...s.itemsByBox, [id]: [] },
    }));
    get().enqueue(mutation('addBox', { id, roomId, number, name, color, statusId: status }));
    return id;
  },

  updateBox: (id, patch) => {
    set((s) => ({ boxes: s.boxes.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
    get().enqueue(mutation('updateBox', { id, ...patch }));
  },

  deleteBox: (boxId) => {
    set((s) => {
      const rest = { ...s.itemsByBox };
      delete rest[boxId];
      return { boxes: s.boxes.filter((b) => b.id !== boxId), itemsByBox: rest };
    });
    get().enqueue(mutation('deleteBox', { id: boxId }));
  },

  setBoxStatus: (boxId, statusId) => {
    set((s) => ({ boxes: s.boxes.map((b) => (b.id === boxId ? { ...b, status: statusId } : b)) }));
    get().enqueue(mutation('setBoxStatus', { id: boxId, statusId }));
  },

  setBoxCover: (boxId, uri) => {
    set((s) => ({ boxes: s.boxes.map((b) => (b.id === boxId ? { ...b, cover: uri } : b)) }));
    // A local URI gets uploaded by the sync engine, which re-calls this with the
    // server photo id; only sync a non-local value (a real id, or an explicit clear).
    if (!uri || !isLocalUri(uri)) {
      get().enqueue(mutation('setBoxCover', { id: boxId, coverPhotoId: uri }));
    }
  },

  toggleBoxMarker: (boxId, markerId) => {
    const box = get().boxes.find((b) => b.id === boxId);
    const on = box ? !box.markers.includes(markerId) : true; // desired state after the toggle
    set((s) => ({
      boxes: s.boxes.map((b) => {
        if (b.id !== boxId) return b;
        const has = b.markers.includes(markerId);
        return { ...b, markers: has ? b.markers.filter((m) => m !== markerId) : [...b.markers, markerId] };
      }),
    }));
    get().enqueue(mutation('setBoxMarker', { boxId, markerId, on }));
  },

  addStatus: ({ label, color }) => {
    const id = uid('st');
    set((s) => ({ statuses: [...s.statuses, { id, label, color, custom: true }] }));
    get().enqueue(mutation('addStatus', { id, label, color }));
    return id;
  },

  addMarker: ({ label, color, icon = 'tag' }) => {
    const id = uid('mk');
    set((s) => ({ markers: [...s.markers, { id, label, color, icon, custom: true }] }));
    get().enqueue(mutation('addMarker', { id, label, color, icon }));
    return id;
  },

  addItem: (boxId, input) => {
    const id = uid('i');
    const item: Item = {
      id,
      boxId,
      name: input.name,
      qty: input.qty ?? 1,
      value: input.value ?? 0,
      note: input.note,
      photos: input.photos ?? [],
      markers: input.markers ?? [],
      icon: input.icon,
    };
    set((s) => ({ itemsByBox: { ...s.itemsByBox, [boxId]: [...(s.itemsByBox[boxId] ?? []), item] } }));
    get().enqueue(
      mutation('addItem', {
        id,
        boxId,
        name: item.name,
        qty: item.qty,
        valueCents: Math.round(item.value * 100),
        note: input.note ?? null,
        icon: input.icon ?? null,
        markerIds: item.markers,
        photoIds: [], // photos are uploaded by the sync engine and attached afterwards
      }),
    );
    return id;
  },

  updateItem: (boxId, itemId, patch) => {
    set((s) => ({
      itemsByBox: {
        ...s.itemsByBox,
        [boxId]: (s.itemsByBox[boxId] ?? []).map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
      },
    }));
    const payload: Extract<Mutation, { type: 'updateItem' }>['payload'] = { id: itemId, boxId };
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.qty !== undefined) payload.qty = patch.qty;
    if (patch.value !== undefined) payload.valueCents = Math.round(patch.value * 100);
    if (patch.note !== undefined) payload.note = patch.note ?? null;
    if (patch.markers !== undefined) payload.markerIds = patch.markers;
    get().enqueue(mutation('updateItem', payload));
  },

  deleteItem: (boxId, itemId) => {
    set((s) => ({
      itemsByBox: { ...s.itemsByBox, [boxId]: (s.itemsByBox[boxId] ?? []).filter((it) => it.id !== itemId) },
    }));
    get().enqueue(mutation('deleteItem', { id: itemId, boxId }));
  },

  moveItem: (fromBoxId, toBoxId, itemId) => {
    set((s) => {
      const item = (s.itemsByBox[fromBoxId] ?? []).find((it) => it.id === itemId);
      if (!item) return {};
      return {
        itemsByBox: {
          ...s.itemsByBox,
          [fromBoxId]: (s.itemsByBox[fromBoxId] ?? []).filter((it) => it.id !== itemId),
          [toBoxId]: [...(s.itemsByBox[toBoxId] ?? []), { ...item, boxId: toBoxId }],
        },
      };
    });
    get().enqueue(mutation('moveItem', { id: itemId, fromBoxId, toBoxId }));
  },

  updateMove: (patch) => {
    set((s) => ({ move: { ...s.move, ...patch } }));
    get().enqueue(mutation('updateMove', { ...patch }));
  },
});
