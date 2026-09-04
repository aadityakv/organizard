// Session, the outbox, and how server data lands in the live slice.
//
// Two ingestion paths: `applySnapshot` replaces the slice wholesale (first open of a
// shared move), `applyChanges` merges a delta. The delta merge has one rule that
// matters: a row with a pending outbox mutation is locally authoritative, and the
// cursor must not advance past a skipped row or a concurrent server edit to it would
// be lost forever.
import type { StateCreator } from 'zustand';

import {
  toClientBox,
  toClientItem,
  toClientMarker,
  toClientMember,
  toClientRoom,
  toClientStatus,
} from '../mappers';
import { emptyLiveSlice, parkCurrentMove } from '../shape';
import { mergeList, moveFromSnapshot, snapItemsByBox } from '../snapshot';
import type { Store, SyncActions } from '../types';
import { MOVE_MODE, type MoveBundle } from '../library';
import { isLocalRef } from '@/lib/photos/refs';

export type SyncSlice = StateCreator<Store, [['zustand/persist', unknown]], [], SyncActions>;

const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;

/** Session, outbox and server-data ingestion actions. */
export const createSyncSlice: SyncSlice = (set) => ({
  setOnboarded: (v) => set({ onboarded: v }),
  startProTrial: () => set({ proTrialUntil: Date.now() + TRIAL_MS }),
  setSession: (session, account) => set({ session, account }),
  restoreSession: (session) => set({ session }),
  resetSyncCursor: () => set({ lastSyncTs: 0 }),

  signOut: () =>
    set((s) => {
      const now = Date.now();
      const library = parkCurrentMove(s, now);
      // Account (synced) moves live in the cloud: drop them from this device. Keep
      // guest/local-only moves.
      const kept: Record<string, MoveBundle> = {};
      for (const [id, b] of Object.entries(library)) if (!b.serverMoveId) kept[id] = b;
      // Back to the guest state: the account-tied Pro trial ends and onboarding shows again.
      const base = { session: null, account: null, library: kept, proTrialUntil: null, onboarded: false };
      if (s.currentMoveId && kept[s.currentMoveId]) return base; // open move survived (local)
      return { ...base, currentMoveId: null, ...emptyLiveSlice(now) };
    }),

  expireSession: () => set({ session: null }),

  enqueue: (m) => set((s) => (s.activeMode === MOVE_MODE.shared ? { outbox: [...s.outbox, m] } : {})),
  clearOutbox: (clientIds) =>
    set((s) => ({ outbox: s.outbox.filter((m) => !clientIds.includes(m.clientId)) })),

  applySnapshot: (snap) =>
    set({
      move: moveFromSnapshot(snap),
      rooms: snap.rooms.map(toClientRoom),
      statuses: snap.statuses.map(toClientStatus),
      markers: snap.markers.map(toClientMarker),
      members: snap.members.map(toClientMember),
      boxes: snap.boxes.map(toClientBox),
      itemsByBox: snapItemsByBox(snap),
    }),

  applyChanges: (ch) =>
    set((s) => {
      const dirty = dirtyRows(s.outbox);

      // Skipping a dirty row must NOT advance the cursor past it — hold the cursor
      // back so the row re-arrives on the next pull.
      let minSkipped = Infinity;
      const fresh = <T extends { id: string; updatedAt: number }>(rows: T[], skip: Set<string>) =>
        rows.filter((r) => {
          if (skip.has(r.id)) {
            minSkipped = Math.min(minSkipped, r.updatedAt);
            return false;
          }
          return true;
        });

      const itemsByBox = { ...s.itemsByBox };
      const boxes = mergeList(s.boxes, fresh(ch.boxes, dirty.boxes), toClientBox);
      for (const b of boxes) if (!itemsByBox[b.id]) itemsByBox[b.id] = [];
      for (const it of ch.items) {
        if (dirty.items.has(it.id)) {
          minSkipped = Math.min(minSkipped, it.updatedAt);
          continue;
        }
        // Preserve local (not-yet-uploaded) photo URIs so a pull can't drop a fresh capture.
        const list = itemsByBox[it.boxId] ?? [];
        const idx = list.findIndex((x) => x.id === it.id);
        const existing = idx >= 0 ? list[idx] : undefined;
        const localPhotos = (existing?.photos ?? []).filter(isLocalRef);
        // Replace in place when the item is already in the box (keeps user-visible
        // order stable across pulls); append only when it is genuinely new.
        const arr = list.filter((x) => x.id !== it.id);
        const at = idx >= 0 ? idx : arr.length;
        if (!it.deletedAt) {
          const ci = toClientItem(it);
          const base = ci.photos ?? [];
          ci.photos = [...base, ...localPhotos.filter((p) => !base.includes(p))];
          arr.splice(at, 0, ci);
        }
        itemsByBox[it.boxId] = arr;
      }

      // Every fresh() (which records minSkipped) runs BEFORE the cursor is computed,
      // so a skipped room/status/marker also holds the cursor back.
      const rooms = mergeList(s.rooms, fresh(ch.rooms, dirty.rooms), toClientRoom);
      const statuses = mergeList(s.statuses, fresh(ch.statuses, dirty.statuses), toClientStatus);
      const markers = mergeList(s.markers, fresh(ch.markers, dirty.markers), toClientMarker);

      // Move details (rename/address/date) ride the delta only when the row changed,
      // and a pending local updateMove wins until it flushes.
      const move =
        ch.move && !dirty.move
          ? {
              name: ch.move.name,
              from: ch.move.from ?? '',
              to: ch.move.to ?? '',
              target: ch.move.targetDate ?? '',
            }
          : s.move;
      if (ch.move && dirty.move) minSkipped = Math.min(minSkipped, ch.move.updatedAt);

      const cursor = minSkipped === Infinity ? ch.cursor : Math.min(ch.cursor, minSkipped - 1);
      return {
        move,
        rooms,
        statuses,
        markers,
        boxes,
        itemsByBox,
        members: ch.members.map(toClientMember),
        lastSyncTs: cursor,
      };
    }),

  parkServerMove: () =>
    set((s) =>
      s.activeMode === MOVE_MODE.shared
        ? {
            // Sync is over for this move (deleted server-side, or a stale bundle from a
            // different account): keep the data as a local-only move, drop its outbox.
            activeMode: MOVE_MODE.local,
            serverMoveId: null,
            outbox: [],
            lastSyncTs: 0,
          }
        : {},
    ),

  goShared: (serverMoveId) => set({ activeMode: MOVE_MODE.shared, serverMoveId, lastSyncTs: 0, outbox: [] }),

  swapItemPhoto: (boxId, itemId, fromUri, toId) =>
    set((s) => ({
      itemsByBox: {
        ...s.itemsByBox,
        [boxId]: (s.itemsByBox[boxId] ?? []).map((it) =>
          it.id === itemId ? { ...it, photos: (it.photos ?? []).map((p) => (p === fromUri ? toId : p)) } : it,
        ),
      },
    })),
});

/** Ids with pending outbox mutations, per collection, so an item edit doesn't suppress an unrelated update to its box row. */
function dirtyRows(outbox: Store['outbox']) {
  const rooms = new Set<string>();
  const statuses = new Set<string>();
  const markers = new Set<string>();
  const boxes = new Set<string>();
  const items = new Set<string>();
  let move = false;
  for (const m of outbox) {
    const p = m.payload as { id?: string; boxId?: string };
    switch (m.type) {
      case 'addRoom':
      case 'updateRoom':
      case 'deleteRoom':
        if (p.id) rooms.add(p.id);
        break;
      case 'addStatus':
        if (p.id) statuses.add(p.id);
        break;
      case 'addMarker':
        if (p.id) markers.add(p.id);
        break;
      case 'addBox':
      case 'updateBox':
      case 'deleteBox':
      case 'setBoxStatus':
      case 'setBoxCover':
        if (p.id) boxes.add(p.id);
        break;
      case 'setBoxMarker':
        if (p.boxId) boxes.add(p.boxId);
        break;
      case 'addItem':
      case 'updateItem':
      case 'deleteItem':
      case 'moveItem':
        if (p.id) items.add(p.id);
        break;
      case 'updateMove':
        move = true;
        break;
    }
  }
  return { rooms, statuses, markers, boxes, items, move };
}
