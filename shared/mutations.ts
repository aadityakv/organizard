// The mutation contract — the heart of the sync engine. The client applies a
// mutation optimistically + queues it; the Worker re-applies it (role-checked)
// when the outbox flushes. clientId makes retries idempotent.
//
// Conflict resolution is ARRIVAL ORDER (the server applies whatever flushes last;
// `ts` is debug/ordering metadata, not compared against stored rows). Concurrent
// edits on two devices resolve to whichever device flushes later.
import { ROLES } from './models';

export type Mutation =
  | {
      type: 'addRoom';
      clientId: string;
      ts: number;
      payload: { id: string; name: string; dest?: string | null; icon: string; color?: string };
    }
  | {
      type: 'updateRoom';
      clientId: string;
      ts: number;
      payload: { id: string; name?: string; dest?: string | null; icon?: string; color?: string };
    }
  | { type: 'deleteRoom'; clientId: string; ts: number; payload: { id: string } }
  | {
      type: 'addBox';
      clientId: string;
      ts: number;
      payload: { id: string; roomId: string; number: number; name: string; color: string; statusId: string };
    }
  | {
      type: 'updateBox';
      clientId: string;
      ts: number;
      payload: { id: string; name?: string; color?: string; roomId?: string };
    }
  | { type: 'deleteBox'; clientId: string; ts: number; payload: { id: string } }
  | { type: 'setBoxStatus'; clientId: string; ts: number; payload: { id: string; statusId: string } }
  | {
      type: 'setBoxCover';
      clientId: string;
      ts: number;
      payload: { id: string; coverPhotoId: string | null };
    }
  | {
      type: 'setBoxMarker';
      clientId: string;
      ts: number;
      payload: { boxId: string; markerId: string; on: boolean };
    }
  | { type: 'addStatus'; clientId: string; ts: number; payload: { id: string; label: string; color: string } }
  | {
      type: 'addMarker';
      clientId: string;
      ts: number;
      payload: { id: string; label: string; color: string; icon: string };
    }
  | {
      type: 'addItem';
      clientId: string;
      ts: number;
      payload: {
        id: string;
        boxId: string;
        name: string;
        qty: number;
        valueCents: number;
        note?: string | null;
        icon?: string | null;
        markerIds?: string[];
        photoIds?: string[];
      };
    }
  | {
      type: 'updateItem';
      clientId: string;
      ts: number;
      payload: {
        id: string;
        boxId: string;
        name?: string;
        qty?: number;
        valueCents?: number;
        note?: string | null;
        markerIds?: string[];
        photoIds?: string[];
      };
    }
  | { type: 'deleteItem'; clientId: string; ts: number; payload: { id: string; boxId: string } }
  | {
      type: 'moveItem';
      clientId: string;
      ts: number;
      payload: { id: string; fromBoxId: string; toBoxId: string };
    }
  | {
      /** Tick an item off (or back on) while unpacking. Intent-based, so a retry is a no-op. */
      type: 'setItemUnpacked';
      clientId: string;
      ts: number;
      payload: { id: string; boxId: string; on: boolean };
    }
  | {
      type: 'updateMove';
      clientId: string;
      ts: number;
      payload: { name?: string; from?: string; to?: string; target?: string };
    };

export type MutationType = Mutation['type'];

/** Minimum role each mutation requires. Enforced server-side (client gating is UX only). */
export type RoleRequirement = 'canEdit' | typeof ROLES.owner;

export const ROLE_REQUIRED: Record<MutationType, RoleRequirement> = {
  addRoom: 'canEdit',
  updateRoom: 'canEdit',
  deleteRoom: 'canEdit',
  addBox: 'canEdit',
  updateBox: 'canEdit',
  deleteBox: ROLES.owner,
  setBoxStatus: 'canEdit',
  setBoxCover: 'canEdit',
  setBoxMarker: 'canEdit',
  addStatus: 'canEdit',
  addMarker: 'canEdit',
  addItem: 'canEdit',
  updateItem: 'canEdit',
  deleteItem: 'canEdit',
  moveItem: 'canEdit',
  setItemUnpacked: 'canEdit',
  updateMove: 'canEdit',
};
