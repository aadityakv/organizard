// The store's shape. State is one flat object (Zustand); actions are grouped by
// concern and implemented in store/slices/*. Nothing here imports React Native, so
// the whole store can be built and exercised in node (see createStore.test.ts).
import type { Box, Item, Marker, Member, Move, Room, Status } from '@/data/types';
import type { ServerChanges, ServerSnapshot } from '@/lib/api';
import type { Mutation } from '@/shared';

import type { MoveBundle, MoveMode } from './library';

export type Account = { id: string; name: string; email: string | null; entitlementActive: boolean };

export type State = {
  onboarded: boolean;
  /** Local Pro entitlement: a 7-day trial expiry (ms). Real billing sets this later. */
  proTrialUntil: number | null;

  move: Move;
  rooms: Room[];
  boxes: Box[];
  statuses: Status[];
  markers: Marker[];
  members: Member[];
  itemsByBox: Record<string, Item[]>;

  /** Signed-in account (null until the user authenticates). */
  account: Account | null;
  /** In-memory session token (loaded from secure-store at boot). */
  session: string | null;
  activeMode: MoveMode;
  /** Server id of the active move when shared. */
  serverMoveId: string | null;
  /** Pending mutations awaiting flush. */
  outbox: Mutation[];
  /** Server timestamp of the last successful delta pull. */
  lastSyncTs: number;

  /** All moves you have, keyed by local id. */
  library: Record<string, MoveBundle>;
  /**
   * Which move is mirrored into the live slice above (null = none open).
   * INVARIANT: for the CURRENT move the live slice is authoritative —
   * `library[currentMoveId]` is a stale copy refreshed only when you leave
   * (createMove / switchMove / addSharedMoveFromSnapshot) or via `moveSummaries`'
   * on-the-fly re-snapshot. Read the live slice for the open move, never the bundle.
   */
  currentMoveId: string | null;
};

/**
 * The item fields an edit may change. Exactly the set that syncs via the
 * `updateItem` mutation — anything else on `Item` (id, boxId) is structural and
 * photos are attached by the upload engine, so the type keeps patches honest.
 */
export type ItemPatch = Partial<Pick<Item, 'name' | 'qty' | 'value' | 'note' | 'markers' | 'photos'>>;

/** Editing the open move. Every action applies locally and, for a shared move, enqueues a Mutation. */
export type InventoryActions = {
  addRoom: (input: { name: string; dest?: string | null; icon?: string; color?: string }) => string;
  updateRoom: (id: string, patch: Partial<Pick<Room, 'name' | 'dest' | 'icon' | 'color'>>) => void;
  deleteRoom: (id: string) => void;
  addBox: (input: { name: string; color: string; roomId: string; status?: string }) => string;
  updateBox: (id: string, patch: Partial<Pick<Box, 'name' | 'color' | 'roomId'>>) => void;
  deleteBox: (boxId: string) => void;
  setBoxStatus: (boxId: string, statusId: string) => void;
  setBoxCover: (boxId: string, uri: string | null) => void;
  toggleBoxMarker: (boxId: string, markerId: string) => void;
  addStatus: (input: { label: string; color: string }) => string;
  addMarker: (input: { label: string; color: string; icon?: string }) => string;
  addItem: (
    boxId: string,
    input: {
      name: string;
      qty?: number;
      value?: number;
      note?: string;
      photos?: string[];
      markers?: string[];
      icon?: string;
    },
  ) => string;
  updateItem: (boxId: string, itemId: string, patch: ItemPatch) => void;
  deleteItem: (boxId: string, itemId: string) => void;
  moveItem: (fromBoxId: string, toBoxId: string, itemId: string) => void;
  updateMove: (patch: { name?: string; from?: string; to?: string; target?: string }) => void;
};

/** Session, outbox and the two ways server data lands: a full snapshot or a delta. */
export type SyncActions = {
  setOnboarded: (v: boolean) => void;
  /** Start the Pro free trial (gate-UI-now; real billing wires in later). */
  startProTrial: () => void;
  setSession: (session: string, account: Account) => void;
  /** Put a token restored from the keychain into memory at boot (account is already persisted). */
  restoreSession: (session: string) => void;
  /** Force the next pull to start from zero (a full re-sync). */
  resetSyncCursor: () => void;
  /**
   * Drop the account from this device: synced moves go (they live in the cloud and
   * are pulled again on the next sign-in), local-only moves stay. State only — the
   * caller clears the keychain token.
   */
  signOut: () => void;
  /** The server no longer accepts the token: forget it but keep every move so a re-login can flush pending edits. */
  expireSession: () => void;
  enqueue: (m: Mutation) => void;
  clearOutbox: (clientIds: string[]) => void;
  applySnapshot: (snap: ServerSnapshot) => void;
  applyChanges: (ch: ServerChanges) => void;
  /**
   * The server no longer has this move for this account (deleted, or a bundle left over
   * from a previous account): park it as local-only so its data survives but sync stops.
   */
  parkServerMove: () => void;
  /** Flip the active (already-pushed) move to shared, keeping local data as-is. */
  goShared: (serverMoveId: string) => void;
  /** Replace a local photo URI with its uploaded server id (local-only, no mutation). */
  swapItemPhoto: (boxId: string, itemId: string, fromUri: string, toId: string) => void;
};

/** The library of moves and which one is open. */
export type LibraryActions = {
  createMove: (input: { name: string; from?: string; to?: string; target?: string }) => string;
  switchMove: (id: string) => void;
  archiveMove: (id: string) => void;
  unarchiveMove: (id: string) => void;
  /** Drop a move from this device. Server teardown lives in services/moves.ts. */
  removeMoveLocal: (id: string) => void;
  /** Add a shared move from a snapshot and open it (used when accepting an invite). */
  addSharedMoveFromSnapshot: (serverMoveId: string, snap: ServerSnapshot) => string;
  /**
   * Add a shared move to the library from a snapshot WITHOUT switching to it (used when
   * pulling your moves after sign-in). No-op if a bundle for serverMoveId already exists.
   */
  importSharedMove: (serverMoveId: string, snap: ServerSnapshot) => void;
  /**
   * Attach an existing local move to its server counterpart (matched by the server
   * move's clientId — the local move's id). Used when a share was interrupted after
   * the server move existed but before the link persisted, so a re-pull adopts the
   * local move instead of duplicating it. The local data is kept and re-queued as a
   * replay batch (server-side adds are idempotent by row id), because the server
   * twin may be empty or partial in exactly this crash window.
   */
  adoptSharedMove: (localId: string, serverMoveId: string) => void;
};

export type Actions = InventoryActions & SyncActions & LibraryActions;
export type Store = State & Actions;
