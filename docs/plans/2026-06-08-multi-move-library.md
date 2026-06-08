# Multi-move Library Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the demo-skinned app into a real product: a library of moves you own — create, switch, archive, delete — with honest sign-in and a working deep-link join.

**Architecture:** Keep the Zustand store's existing flat "active move" slice as the live working copy (so every screen/action is unchanged), and wrap a `library: Record<id, MoveBundle>` + `currentMoveId` around it. All the risky per-move snapshot/hydrate logic lives in a **pure, expo-free module** `store/library.ts` that is unit-tested with vitest. Roles are derived, not toggled. Join is a client deep-link route hitting the already-built server `acceptInvite`. Owner-only move deletion gets a new server endpoint with TDD.

**Tech Stack:** Expo Router 4 / React Native 0.76, Zustand 5 (+persist/AsyncStorage), Hono + Drizzle on Cloudflare Workers (server), vitest.

**Working dir:** `/Users/aaditya/Projects/organizard/.worktrees/multi-move-library` (branch `multi-move-library`). Run all client commands from there; server commands from its `server/` subdir.

**Design:** `docs/plans/2026-06-08-multi-move-library-design.md`

---

## Conventions for the executor

- Reference existing styling/patterns; match the file you're editing (Fredoka/Nunito fonts via `@/theme`, `Sheet`/`Input`/`Button` from `@/components`).
- After every code task: `npm run typecheck` (from the worktree root) must pass before committing.
- TDD applies to the **pure library module** and the **server**. UI/store-wiring tasks are gated on typecheck + the explicit manual smoke noted in each task (no RN test runner this round — YAGNI; the dangerous logic is isolated into the pure module instead).
- Commit after each task with the message shown.

---

## Phase 0 — Branch baseline & design doc

### Task 0: Commit the design doc on the branch

**Step 1:** Confirm you're in the worktree on the right branch.

Run: `git -C /Users/aaditya/Projects/organizard/.worktrees/multi-move-library status -sb`
Expected: `## multi-move-library`, with `docs/plans/2026-06-08-multi-move-library-*.md` untracked.

**Step 2: Commit**

```bash
git add docs/plans/2026-06-08-multi-move-library-design.md docs/plans/2026-06-08-multi-move-library.md
git commit -m "docs: multi-move library design + implementation plan"
```

---

## Phase 1 — Pure move-library core (TDD)

The snapshot/hydrate logic is where data loss would happen (switching moves must never drop the move you're leaving). Isolate it from expo and test it directly.

### Task 1: Add a client test runner scoped to pure modules

**Files:**
- Modify: `package.json` (devDeps + script)
- Create: `vitest.config.ts`

**Step 1: Install vitest (dev only)**

```bash
npm install -D vitest@^2.1.8
```

**Step 2: Create `vitest.config.ts`** — scope it to pure store/data tests so it never loads React Native:

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Pure-logic tests only (store/data). We deliberately do NOT load the RN/expo
// runtime here — keep tested modules free of expo imports.
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, '.') } },
  test: {
    environment: 'node',
    include: ['store/**/*.test.ts', 'data/**/*.test.ts'],
  },
});
```

**Step 3: Add script** to `package.json` `scripts`:

```json
"test": "vitest run"
```

**Step 4: Verify** the runner starts (no tests yet is fine):

Run: `npm test`
Expected: vitest runs, "No test files found" (exit 1 is OK here) — confirms it loads without RN errors.

**Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "test: add vitest scoped to pure store/data modules"
```

### Task 2: Starter statuses/markers for a fresh move

**Files:**
- Create: `data/defaults.ts`
- Modify: `data/mockData.ts` (re-export from defaults to stay DRY — optional)

**Step 1: Create `data/defaults.ts`** — the built-in (non-custom) sets a new move starts with:

```ts
// The lifecycle statuses and handling markers every new move starts with.
import type { Marker, Status } from './types';

export const STARTER_STATUSES: Status[] = [
  { id: 'packing', label: 'Packing', color: 'amber' },
  { id: 'sealed', label: 'Sealed', color: 'green' },
  { id: 'transit', label: 'In transit', color: 'sky' },
  { id: 'unpacked', label: 'Unpacked', color: 'slate' },
];

export const STARTER_MARKERS: Marker[] = [
  { id: 'mk_fragile', label: 'Fragile', color: 'coral', icon: 'wine' },
  { id: 'mk_open1', label: 'Open first', color: 'teal', icon: 'package-open' },
  { id: 'mk_heavy', label: 'Heavy', color: 'indigo', icon: 'dumbbell' },
  { id: 'mk_dry', label: 'Keep dry', color: 'sky', icon: 'umbrella' },
  { id: 'mk_up', label: 'This way up', color: 'amber', icon: 'arrow-up' },
];
```

**Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

**Step 3: Commit**

```bash
git add data/defaults.ts
git commit -m "feat: starter statuses/markers for new moves"
```

### Task 3: Pure library module — types + helpers (TDD)

**Files:**
- Create: `store/library.ts`
- Test: `store/library.test.ts`

This module imports ONLY types, `@/lib/uid` (pure), and `@/data/defaults`. No expo, no zustand. `now`/`id` are passed in for determinism.

**Step 1: Write the failing test** `store/library.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Mutation } from '@/shared';
import { newBundle, sliceFromBundle, snapshotInto, summarize, roleFor, type MoveBundle, type SliceData } from './library';
import { STARTER_STATUSES, STARTER_MARKERS } from '@/data/defaults';

const emptyMove = { name: 'Test Move', from: '', to: '', target: '' };

describe('newBundle', () => {
  it('creates an empty local move with starter statuses/markers and no boxes', () => {
    const b = newBundle('mv_1', emptyMove, 1000);
    expect(b.id).toBe('mv_1');
    expect(b.archived).toBe(false);
    expect(b.createdAt).toBe(1000);
    expect(b.activeMode).toBe('local');
    expect(b.serverMoveId).toBeNull();
    expect(b.boxes).toEqual([]);
    expect(b.itemsByBox).toEqual({});
    expect(b.statuses).toEqual(STARTER_STATUSES);
    expect(b.markers).toEqual(STARTER_MARKERS);
    expect(b.outbox).toEqual([]);
  });
});

describe('sliceFromBundle / snapshotInto round-trip', () => {
  it('hydrating a slice then snapshotting it back is lossless', () => {
    const b = newBundle('mv_1', emptyMove, 1000);
    const withBox: MoveBundle = {
      ...b,
      boxes: [{ id: 'b1', number: 1, name: 'Books', color: 'amber', roomId: 'r1', status: 'packing', markers: [], cover: null }],
      rooms: [{ id: 'r1', name: 'Office', dest: null, icon: 'briefcase' }],
      itemsByBox: { b1: [{ id: 'i1', boxId: 'b1', name: 'Novel', qty: 1, value: 0 }] },
    };
    const slice = sliceFromBundle(withBox);
    const restored = snapshotInto(b, slice, 2000); // meta from b, data from slice
    expect(restored.boxes).toEqual(withBox.boxes);
    expect(restored.itemsByBox).toEqual(withBox.itemsByBox);
    expect(restored.rooms).toEqual(withBox.rooms);
    expect(restored.id).toBe('mv_1');         // meta preserved
    expect(restored.lastOpenedAt).toBe(2000); // meta updated
  });
});

describe('summarize', () => {
  it('counts boxes and items and reports mode/archived', () => {
    const b: MoveBundle = {
      ...newBundle('mv_1', emptyMove, 1000),
      boxes: [{ id: 'b1', number: 1, name: 'Books', color: 'amber', roomId: 'r1', status: 'packing', markers: [], cover: null }],
      itemsByBox: { b1: [{ id: 'i1', boxId: 'b1', name: 'Novel', qty: 2, value: 0 }] },
    };
    const s = summarize(b);
    expect(s.id).toBe('mv_1');
    expect(s.name).toBe('Test Move');
    expect(s.boxCount).toBe(1);
    expect(s.itemCount).toBe(2);  // sums qty
    expect(s.mode).toBe('local');
    expect(s.archived).toBe(false);
  });
});

describe('roleFor', () => {
  it('a local move is always owner', () => {
    expect(roleFor('local', [], 'u1')).toBe('owner');
  });
  it('a shared move uses membership role, defaulting to viewer', () => {
    const members = [{ id: 'u1', name: 'Me', role: 'editor' as const }];
    expect(roleFor('shared', members, 'u1')).toBe('editor');
    expect(roleFor('shared', members, 'u2')).toBe('viewer');
    expect(roleFor('shared', members, null)).toBe('viewer');
  });
});
```

**Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `./library` exports.

**Step 3: Implement `store/library.ts`:**

```ts
// Pure move-library core: no expo, no zustand. Deterministic (now/id passed in)
// so the snapshot/hydrate logic that protects against data loss is unit-tested.
import type { Box, Item, Marker, Member, Move, Role, Room, Status } from '@/data/types';
import { STARTER_MARKERS, STARTER_STATUSES } from '@/data/defaults';
import type { Mutation } from '@/shared';

export type MoveMode = 'local' | 'shared';

/** The per-move fields mirrored into the store's live "active slice". */
export type SliceData = {
  move: Move;
  rooms: Room[];
  boxes: Box[];
  statuses: Status[];
  markers: Marker[];
  members: Member[];
  itemsByBox: Record<string, Item[]>;
  activeMode: MoveMode;
  serverMoveId: string | null;
  outbox: Mutation[];
  lastSyncTs: number;
};

/** A move at rest in the library: its data + sync state + lifecycle meta. */
export type MoveBundle = SliceData & {
  id: string;
  archived: boolean;
  createdAt: number;
  lastOpenedAt: number;
};

export type MoveSummary = {
  id: string;
  name: string;
  from: string;
  to: string;
  target: string;
  mode: MoveMode;
  archived: boolean;
  boxCount: number;
  itemCount: number;
  lastOpenedAt: number;
};

const SLICE_KEYS: (keyof SliceData)[] = [
  'move', 'rooms', 'boxes', 'statuses', 'markers', 'members', 'itemsByBox',
  'activeMode', 'serverMoveId', 'outbox', 'lastSyncTs',
];

/** Empty local move seeded with the starter statuses/markers. */
export function newBundle(id: string, move: Move, now: number): MoveBundle {
  return {
    id,
    archived: false,
    createdAt: now,
    lastOpenedAt: now,
    move,
    rooms: [],
    boxes: [],
    statuses: [...STARTER_STATUSES],
    markers: [...STARTER_MARKERS],
    members: [],
    itemsByBox: {},
    activeMode: 'local',
    serverMoveId: null,
    outbox: [],
    lastSyncTs: 0,
  };
}

/** Pull just the live-slice fields out of a bundle (for hydration). */
export function sliceFromBundle(b: MoveBundle): SliceData {
  const out = {} as SliceData;
  for (const k of SLICE_KEYS) (out as Record<string, unknown>)[k] = b[k];
  return out;
}

/** Fold a live slice back onto a bundle's meta (for snapshotting on switch). */
export function snapshotInto(meta: MoveBundle, slice: SliceData, now: number): MoveBundle {
  return { ...meta, ...slice, lastOpenedAt: now };
}

export function summarize(b: MoveBundle): MoveSummary {
  let itemCount = 0;
  for (const items of Object.values(b.itemsByBox)) for (const it of items) itemCount += it.qty || 1;
  return {
    id: b.id,
    name: b.move.name,
    from: b.move.from,
    to: b.move.to,
    target: b.move.target,
    mode: b.activeMode,
    archived: b.archived,
    boxCount: b.boxes.length,
    itemCount,
    lastOpenedAt: b.lastOpenedAt,
  };
}

/** Derived role: local ⇒ owner; shared ⇒ your membership role (default viewer). */
export function roleFor(mode: MoveMode, members: Member[], accountId: string | null): Role {
  if (mode === 'local') return 'owner';
  return members.find((m) => m.id === accountId)?.role ?? 'viewer';
}
```

**Step 4: Run to verify pass**

Run: `npm test`
Expected: PASS (4 describe blocks green).

**Step 5: Commit**

```bash
git add store/library.ts store/library.test.ts
git commit -m "feat: pure move-library core (snapshot/hydrate/summarize/role) + tests"
```

---

## Phase 2 — Store integration

Wire the library into `store/useStore.ts` using the pure helpers. **No expo logic in the math** — the store just calls `library.ts`.

### Task 4: Library state, actions, and selectors in the store

**Files:**
- Modify: `store/useStore.ts`

**Step 1:** Add imports at the top:

```ts
import { STARTER_MARKERS, STARTER_STATUSES } from '@/data/defaults';
import {
  newBundle, sliceFromBundle, snapshotInto, summarize, roleFor,
  type MoveBundle, type MoveSummary, type SliceData,
} from './library';
```

**Step 2:** In `type State`, **remove** `role: Role;` and **add**:

```ts
  /** All moves you have, keyed by local id. */
  library: Record<string, MoveBundle>;
  /** Which move is mirrored into the live slice above (null = none open). */
  currentMoveId: string | null;
```

(Keep `MoveMode` importing from `./library` instead of redefining — delete the local `export type MoveMode` line and re-export: `export type { MoveMode } from './library';`.)

**Step 3:** In `type Actions`, **remove** `setRole`. **Add**:

```ts
  createMove: (input: { name: string; from?: string; to?: string; target?: string }) => string;
  switchMove: (id: string) => void;
  archiveMove: (id: string) => void;
  unarchiveMove: (id: string) => void;
  removeMoveLocal: (id: string) => void; // drops the bundle from this device (server teardown handled by caller)
  addSharedMoveFromSnapshot: (serverMoveId: string, snap: ServerSnapshot) => string;
```

**Step 4:** Change `initialState` — **remove the seed**, start empty, and drop `role`:

```ts
const EMPTY_MOVE: Move = { name: '', from: '', to: '', target: '' };

const initialState: State = {
  onboarded: false,
  move: EMPTY_MOVE,
  rooms: [],
  boxes: [],
  statuses: [...STARTER_STATUSES],
  markers: [...STARTER_MARKERS],
  members: [],
  itemsByBox: {},

  account: null,
  session: null,
  activeMode: 'local',
  serverMoveId: null,
  outbox: [],
  lastSyncTs: 0,

  library: {},
  currentMoveId: null,
};
```

Delete the `seedBoxes/seedItems/...` imports from `@/data/mockData` (no longer wired).

**Step 5:** Remove `setRole: (role) => set({ role }),`. Add the new actions inside the store body. Use `Date.now()` and `uid('mv')` here, delegating math to `library.ts`:

```ts
      createMove: ({ name, from = '', to = '', target = '' }) => {
        const id = uid('mv');
        const now = Date.now();
        const bundle = newBundle(id, { name, from, to, target }, now);
        set((s) => {
          const library = { ...s.library };
          // snapshot whatever is open before we overwrite the live slice
          if (s.currentMoveId && library[s.currentMoveId]) {
            library[s.currentMoveId] = snapshotInto(library[s.currentMoveId], extractSlice(s), now);
          }
          library[id] = bundle;
          return { library, currentMoveId: id, ...sliceFromBundle(bundle) };
        });
        return id;
      },

      switchMove: (id) =>
        set((s) => {
          if (id === s.currentMoveId) return {};
          const target = s.library[id];
          if (!target) return {};
          const now = Date.now();
          const library = { ...s.library };
          if (s.currentMoveId && library[s.currentMoveId]) {
            library[s.currentMoveId] = snapshotInto(library[s.currentMoveId], extractSlice(s), now);
          }
          const opened = { ...target, lastOpenedAt: now };
          library[id] = opened;
          return { library, currentMoveId: id, ...sliceFromBundle(opened) };
        }),

      archiveMove: (id) =>
        set((s) => (s.library[id] ? { library: { ...s.library, [id]: { ...s.library[id], archived: true } } } : {})),
      unarchiveMove: (id) =>
        set((s) => (s.library[id] ? { library: { ...s.library, [id]: { ...s.library[id], archived: false } } } : {})),

      removeMoveLocal: (id) =>
        set((s) => {
          const library = { ...s.library };
          delete library[id];
          if (s.currentMoveId !== id) return { library };
          // deleting the open move: clear the live slice (caller routes to /moves)
          return { library, currentMoveId: null, ...sliceFromBundle(newBundle('__none__', EMPTY_MOVE, Date.now())), activeMode: 'local', serverMoveId: null, outbox: [], lastSyncTs: 0 };
        }),

      addSharedMoveFromSnapshot: (serverMoveId, snap) => {
        const id = uid('mv');
        const now = Date.now();
        set((s) => {
          const library = { ...s.library };
          if (s.currentMoveId && library[s.currentMoveId]) {
            library[s.currentMoveId] = snapshotInto(library[s.currentMoveId], extractSlice(s), now);
          }
          const bundle: MoveBundle = {
            ...newBundle(id, { name: snap.move.name, from: snap.move.from ?? '', to: snap.move.to ?? '', target: snap.move.targetDate ?? '' }, now),
            activeMode: 'shared',
            serverMoveId,
            statuses: snap.statuses.map(toClientStatus),
            markers: snap.markers.map(toClientMarker),
            members: snap.members.map(toClientMember),
            rooms: snap.rooms.map(toClientRoom),
            boxes: snap.boxes.map(toClientBox),
            itemsByBox: snapItemsByBox(snap),
            lastSyncTs: 0,
            outbox: [],
          };
          library[id] = bundle;
          return { library, currentMoveId: id, ...sliceFromBundle(bundle) };
        });
        return id;
      },
```

Add two small local helpers near the bottom of the file (above the selectors):

```ts
/** Pull the live-slice fields off the full store state. */
function extractSlice(s: State): SliceData {
  return {
    move: s.move, rooms: s.rooms, boxes: s.boxes, statuses: s.statuses, markers: s.markers,
    members: s.members, itemsByBox: s.itemsByBox, activeMode: s.activeMode,
    serverMoveId: s.serverMoveId, outbox: s.outbox, lastSyncTs: s.lastSyncTs,
  };
}

function snapItemsByBox(snap: ServerSnapshot): Record<string, Item[]> {
  const out: Record<string, Item[]> = {};
  for (const b of snap.boxes) out[b.id] = [];
  for (const it of snap.items) (out[it.boxId] ??= []).push(toClientItem(it));
  return out;
}
```

**Step 6:** Refactor `markActiveShared` (used by the local→shared upgrade) so it also records `currentMoveId` consistency — it already mutates the live slice, which is fine because the *current* move is the one being shared. Leave `goShared` as-is. No change required, but verify `shareMove` path still targets the current move (it does — it operates on the live slice).

**Step 7:** Update `partialize` to persist the new fields and drop `role`:

```ts
      partialize: (s) => ({
        onboarded: s.onboarded,
        move: s.move, rooms: s.rooms, boxes: s.boxes, statuses: s.statuses,
        markers: s.markers, members: s.members, itemsByBox: s.itemsByBox,
        account: s.account, activeMode: s.activeMode, serverMoveId: s.serverMoveId,
        outbox: s.outbox, lastSyncTs: s.lastSyncTs,
        library: s.library, currentMoveId: s.currentMoveId,
      }),
```

**Step 8:** Bump `version: 2` → `version: 3` and extend `migrate` (see Task 5).

**Step 9:** Add selectors at the bottom:

```ts
export const moveSummaries = (s: Store): MoveSummary[] => {
  const out: MoveSummary[] = [];
  for (const b of Object.values(s.library)) {
    out.push(b.id === s.currentMoveId ? summarize(snapshotInto(b, extractSlice(s), b.lastOpenedAt)) : summarize(b));
  }
  return out.sort((a, z) => z.lastOpenedAt - a.lastOpenedAt);
};

export const currentRole = (s: Store): Role => roleFor(s.activeMode, s.members, s.account?.id ?? null);
```

**Step 10: Typecheck**

Run: `npm run typecheck`
Expected: errors ONLY in the screens that still read `s.role` / render `RoleSwitcher` (fixed in Phase 3) and any `setRole` callers. Note them; nothing else should break.

**Step 11: Commit**

```bash
git add store/useStore.ts
git commit -m "feat(store): move library — create/switch/archive/delete + derived role"
```

### Task 5: Migration v2 → v3 (drop the mock, keep a real shared move)

**Files:**
- Modify: `store/useStore.ts` (the `migrate` fn)

**Step 1:** Replace `migrate` with:

```ts
      migrate: (persisted, version) => {
        const st = persisted as (Partial<State> & Record<string, unknown>) | undefined;
        if (!st) return st as Store;

        // v2→v3: introduce the library. The old shape was a single flat move.
        if (version < 3) {
          const known = (m: Mutation) => KNOWN_MUTATION_TYPES.has(m.type);
          const outbox = Array.isArray(st.outbox) ? (st.outbox as Mutation[]).filter(known) : [];
          const isRealShared = st.activeMode === 'shared' && Boolean(st.serverMoveId);
          const now = Date.now();

          if (isRealShared) {
            // Preserve the existing shared move as the current bundle.
            const id = uid('mv');
            const bundle: MoveBundle = {
              id, archived: false, createdAt: now, lastOpenedAt: now,
              move: st.move as Move, rooms: (st.rooms as Room[]) ?? [], boxes: (st.boxes as Box[]) ?? [],
              statuses: (st.statuses as Status[]) ?? [...STARTER_STATUSES], markers: (st.markers as Marker[]) ?? [...STARTER_MARKERS],
              members: (st.members as Member[]) ?? [], itemsByBox: (st.itemsByBox as Record<string, Item[]>) ?? {},
              activeMode: 'shared', serverMoveId: st.serverMoveId as string, outbox, lastSyncTs: (st.lastSyncTs as number) ?? 0,
            };
            return { ...st, role: undefined, library: { [id]: bundle }, currentMoveId: id } as unknown as Store;
          }

          // Otherwise (the NYC mock or a plain local move) reset to an empty library.
          return {
            ...st, role: undefined, onboarded: false, library: {}, currentMoveId: null,
            move: { name: '', from: '', to: '', target: '' },
            rooms: [], boxes: [], statuses: [...STARTER_STATUSES], markers: [...STARTER_MARKERS],
            members: [], itemsByBox: {}, activeMode: 'local', serverMoveId: null, outbox: [], lastSyncTs: 0,
          } as unknown as Store;
        }
        return st as Store;
      },
```

**Step 2: Typecheck**

Run: `npm run typecheck`
Expected: same screen-level errors as Task 4 (no new ones in the store).

**Step 3: Manual check (simulator)** — see Phase 8 for the run command. On first launch after upgrade you should land on the empty Moves home (mock gone). Defer this verification until the UI exists; for now confirm typecheck.

**Step 4: Commit**

```bash
git add store/useStore.ts
git commit -m "feat(store): v3 migration — drop the demo mock, seed the library"
```

---

## Phase 3 — Derive roles in the screens

### Task 6: Replace the demo role toggle with `currentRole`

**Files:**
- Modify: `app/(tabs)/index.tsx` (remove `RoleSwitcher` import + `<RoleSwitcher />`; swap role read)
- Modify: `app/box/[id].tsx`
- Modify: `app/add-item.tsx`
- Delete: `components/RoleSwitcher.tsx`
- Modify: `components/index.ts` (drop the `RoleSwitcher` export if present)

**Step 1:** In each of the three screens, replace:

```ts
import { useStore } from '@/store/useStore';
// ...
const role = useStore((s) => s.role);
```

with:

```ts
import { currentRole, useStore } from '@/store/useStore';
// ...
const role = useStore(currentRole);
```

**Step 2:** In `app/(tabs)/index.tsx`: remove `RoleSwitcher` from the `@/components` import list and delete the `<RoleSwitcher />` line (currently `app/(tabs)/index.tsx:473`).

**Step 3:** Delete the component and its barrel export:

```bash
git rm components/RoleSwitcher.tsx
```
Edit `components/index.ts` to remove any `RoleSwitcher` export line.

**Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS (the role errors from Phase 2 are now resolved).

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: derive role from move mode/membership; remove demo RoleSwitcher"
```

---

## Phase 4 — Moves home + navigation

### Task 7: The Moves home screen

**Files:**
- Create: `app/moves.tsx`
- Modify: `app/_layout.tsx` (register the screen)

**Step 1: Register the route** in `app/_layout.tsx` `<Stack>`:

```tsx
<Stack.Screen name="moves" />
<Stack.Screen name="new-move" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
<Stack.Screen name="invite" options={{ presentation: 'modal', animation: 'fade' }} />
```

**Step 2: Create `app/moves.tsx`.** A `SafeAreaView` + `ScrollView` with two sections built from `moveSummaries`. Reuse `Header`, `Card`, `Button`, `Badge`, `Icon`, `GeckoMark` from `@/components` and `@/theme` tokens; match the styling of `app/share.tsx`. Behavior:

- `const summaries = useStore(useShallow(moveSummaries));`
- Split into `active = summaries.filter(s => !s.archived)` and `archived = summaries.filter(s => s.archived)`.
- **Empty state** (`summaries.length === 0`): hero (GeckoMark + wordmark + tagline, lift from `app/onboarding.tsx`'s hero styles) and two large buttons: **Create a move** → `router.push('/new-move')`, **Join a move** → `router.push('/moves/join')` *(a paste-link sheet; see Task 9 note)*.
- **Active section:** a row per move (name, `from → to`, target, `boxCount boxes · itemCount items`, a `Local`/`Shared` + role `Badge`). Tap → `useStore.getState().switchMove(id); router.replace('/(tabs)')`. A trailing `⋯` opens a `Sheet` with **Archive** and, when `mode/role` allows, **Delete** (Task 10).
- **Archived section:** collapsed header "Archived (N)"; expand to show rows; row actions **Unarchive** and **Delete**.
- Top of screen: **+ New move** in the `Header` trailing slot.

Keep it under ~250 lines; lean on existing components. Provide `accessibilityLabel`s.

**Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

**Step 4: Commit**

```bash
git add app/moves.tsx app/_layout.tsx
git commit -m "feat: Moves home — active/archived library with switch"
```

### Task 8: Launch routing + in-app switch affordance

**Files:**
- Modify: `app/index.tsx`
- Modify: `app/(tabs)/index.tsx` (dashboard header leading → Moves)

**Step 1:** Rewrite `app/index.tsx` so launch lands on the current move, else the library:

```tsx
import { Redirect } from 'expo-router';
import { useStore } from '@/store/useStore';

export default function Index() {
  const currentMoveId = useStore((s) => s.currentMoveId);
  return <Redirect href={currentMoveId ? '/(tabs)' : '/moves'} />;
}
```

(The `onboarded` flag is no longer the gate — an empty library is the first-run signal. Leave `onboarded` in the store for now; it's harmless.)

**Step 2:** In `app/(tabs)/index.tsx`, make the header `leading` a "back to Moves" control instead of the static gecko tile:

```tsx
leading={
  <IconButton icon="chevron-left" variant="plain" size="sm" accessibilityLabel="Switch move" onPress={() => router.push('/moves')} />
}
```

(Keep `router` imported from `expo-router`; it already is in this file via the share button.)

**Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

**Step 4: Commit**

```bash
git add app/index.tsx app/(tabs)/index.tsx
git commit -m "feat: launch into current move; header switches back to Moves"
```

### Task 9: Create-move screen

**Files:**
- Create: `app/new-move.tsx`

**Step 1:** A modal screen with `Input`s: **Name** (required), and optional **From** / **To** / **Target date**. Primary `Button` "Create move":

```tsx
const id = useStore.getState().createMove({ name: name.trim(), from: from.trim(), to: to.trim(), target: target.trim() });
router.replace('/(tabs)');
```

Disable the button when `!name.trim()`. Header with a back/close that `router.back()`s. Match `app/share.tsx` card styling.

**Step 2: Typecheck → Commit**

```bash
git add app/new-move.tsx
git commit -m "feat: create-move screen"
```

---

## Phase 5 — Join via deep link

### Task 10: Invite deep-link handler

**Files:**
- Create: `app/invite.tsx`

The link is `organizard://invite?token=<token>` → route `invite`, search param `token`. Server `acceptInvite` already returns a full snapshot; the snapshot's `move.id` is the server move id (as `lib/share.ts` already relies on).

**Step 1: Create `app/invite.tsx`:**

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components';
import { api, ApiError } from '@/lib/api';
import { appleSignInAvailable, signInWithApple } from '@/lib/auth';
import { useStore } from '@/store/useStore';
import { colors, fonts } from '@/theme';

const FRIENDLY: Record<string, string> = {
  INVITE_INVALID: "That invite link isn't valid.",
  INVITE_USED: 'That invite has already been used.',
  INVITE_EXPIRED: 'That invite link has expired.',
};

export default function InviteAccept() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [status, setStatus] = useState<'working' | 'need-signin' | 'error'>('working');
  const [message, setMessage] = useState('Joining…');

  const accept = async () => {
    setStatus('working');
    setMessage('Joining…');
    try {
      let session = useStore.getState().session;
      if (!session) {
        if (!(await appleSignInAvailable())) { setStatus('need-signin'); setMessage('Sign in to join this move.'); return; }
        await signInWithApple();
        session = useStore.getState().session;
      }
      if (!session || !token) throw new ApiError(400, 'INVITE_INVALID');
      const snap = await api.acceptInvite(session, token);
      const serverMoveId = (snap.move as { id: string }).id;
      useStore.getState().addSharedMoveFromSnapshot(serverMoveId, snap);
      router.replace('/(tabs)');
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof ApiError && FRIENDLY[e.code] ? FRIENDLY[e.code] : 'Could not join this move.');
    }
  };

  useEffect(() => { void accept(); /* eslint-disable-next-line */ }, [token]);

  return (
    <View style={styles.center}>
      {status === 'working' ? <ActivityIndicator color={colors.brand} /> : null}
      <Text style={styles.text}>{message}</Text>
      {status !== 'working' ? (
        <Button onPress={status === 'need-signin' ? accept : () => router.replace('/moves')}>
          {status === 'need-signin' ? 'Continue with Apple' : 'Back to moves'}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: colors.surfaceApp },
  text: { fontFamily: fonts.body.bold, fontSize: 15, color: colors.textBody, textAlign: 'center' },
});
```

**Step 2:** For the in-app "Join a move" button (Moves empty state / home), present a small paste-link sheet that extracts the token from a pasted `organizard://invite?token=…` (or raw token) and routes to `/invite?token=…`. Implement inline in `app/moves.tsx` using a `Sheet` + `Input` (no new route needed): parse with `const t = pasted.split('token=')[1]?.trim() ?? pasted.trim(); router.push(\`/invite?token=${t}\`)`.

**Step 3: Typecheck → Commit**

```bash
git add app/invite.tsx app/moves.tsx
git commit -m "feat: join a move via organizard://invite deep link"
```

---

## Phase 6 — Share tab consolidation

### Task 11: Make the Share tab the real screen; delete the mock

**Files:**
- Delete: `app/(tabs)/members.tsx` (the mock with `GECKO-4F2`)
- Move: real share UI from `app/share.tsx` into `app/(tabs)/members.tsx` (so the bottom "Share" tab IS the real screen)
- Modify: `app/(tabs)/index.tsx` (the header user-plus button → switch to the Share tab instead of `router.push('/share')`)
- Modify: `app/_layout.tsx` (drop the standalone `share` Stack screen if it's no longer routed)

**Step 1:** Replace the contents of `app/(tabs)/members.tsx` with the default export from `app/share.tsx` (the real `ShareScreen`), keeping the tab's safe-area/Header chrome. Update relative imports. Delete `app/share.tsx`.

**Step 2:** In `app/(tabs)/index.tsx`, change the header user-plus button to `onPress={() => router.push('/(tabs)/members')}` (or use the tab navigation). Remove the `/share` route from `_layout`.

**Step 3:** Grep for stragglers: `grep -rn "'/share'\|\"/share\"\|app/share" app` → expect none.

**Step 4: Typecheck → Commit**

```bash
git add -A
git commit -m "refactor: Share tab uses the real share/members screen; remove mock"
```

---

## Phase 7 — Server: delete a move (owner-only)

### Task 12: Establish the server test baseline

**Step 1:**

```bash
cd /Users/aaditya/Projects/organizard/.worktrees/multi-move-library/server
npm install
npm test 2>&1 | tail -20
```

Expected: existing suite passes. Record the count. If anything fails pre-change, STOP and report.

### Task 13: DELETE /v1/moves/:id (TDD)

**Files:**
- Test: `server/test/moves-delete.test.ts` (new)
- Modify: `server/src/repos/moves.ts` (add `deleteMove`)
- Modify: `server/src/routes/moves.ts` (add the route)

**Step 1: Write the failing test** `server/test/moves-delete.test.ts` (mirror `sharing.test.ts` style/harness):

```ts
import { describe, expect, it } from 'vitest';
import { makeHarness } from './helpers/harness';

const auth = (s: string) => ({ headers: { Authorization: `Bearer ${s}` } });

async function ownerWithMove(h: Awaited<ReturnType<typeof makeHarness>>) {
  const owner = await h.login('owner', 'o@x.com');
  const snap = (await (await h.json('/v1/moves', { name: 'NYC' }, auth(owner.session))).json()) as { move: { id: string } };
  return { owner, moveId: snap.move.id };
}

describe('DELETE /v1/moves/:id', () => {
  it('owner deletes the move and it is gone', async () => {
    const h = await makeHarness();
    const { owner, moveId } = await ownerWithMove(h);
    const del = await h.request(`/v1/moves/${moveId}`, { method: 'DELETE', ...auth(owner.session) });
    expect(del.status).toBe(200);
    expect((await h.request(`/v1/moves/${moveId}`, auth(owner.session))).status).toBe(404);
  });

  it('an editor cannot delete (403)', async () => {
    const h = await makeHarness();
    const { owner, moveId } = await ownerWithMove(h);
    const inv = await (await h.json(`/v1/moves/${moveId}/invites`, { role: 'editor' }, auth(owner.session))).json() as { token: string };
    const jo = await h.login('jo', 'jo@x.com');
    await h.json(`/v1/invites/${inv.token}/accept`, {}, auth(jo.session));
    const del = await h.request(`/v1/moves/${moveId}`, { method: 'DELETE', ...auth(jo.session) });
    expect(del.status).toBe(403);
  });

  it('a non-member gets 404 (existence not leaked)', async () => {
    const h = await makeHarness();
    const { moveId } = await ownerWithMove(h);
    const stranger = await h.login('x', 'x@x.com');
    const del = await h.request(`/v1/moves/${moveId}`, { method: 'DELETE', ...auth(stranger.session) });
    expect(del.status).toBe(404);
  });
});
```

> Check `server/test/helpers/harness.ts` for the exact request helper signature (it may be `h.request(path, init)` or similar) and adjust the DELETE calls to match. Mirror how existing tests issue non-GET requests.

**Step 2: Run to verify it fails**

Run (in `server/`): `npm test -- moves-delete`
Expected: FAIL (route 404s / not implemented).

**Step 3: Implement `deleteMove`** in `server/src/repos/moves.ts`. There are no `onDelete: cascade` FKs in the schema, so delete children explicitly in FK-safe order, in a transaction:

```ts
import { boxMarkers, boxes, invites, itemMarkers, items, markers, members, moves, mutationLog, photos, rooms, statuses } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function deleteMove(db: AppDb, moveId: string): Promise<void> {
  // Children first; join tables (boxMarkers/itemMarkers) before their parents.
  await db.delete(itemMarkers).where(/* itemMarkers has no moveId — delete by items in move */);
  // Simpler: delete leaf rows scoped by moveId where the column exists, and the
  // join tables by subquery on items/boxes/markers of this move.
  // Order: itemMarkers, boxMarkers, items, boxes, rooms, statuses, markers, photos, invites, members, mutationLog, moves.
}
```

Concretely (D1/SQLite via Drizzle; use `inArray` for the join tables keyed off this move's boxes/items/markers):

```ts
export async function deleteMove(db: AppDb, moveId: string): Promise<void> {
  const boxIds = (await db.select({ id: boxes.id }).from(boxes).where(eq(boxes.moveId, moveId))).map((r) => r.id);
  const itemIds = (await db.select({ id: items.id }).from(items).where(eq(items.moveId, moveId))).map((r) => r.id);
  if (itemIds.length) await db.delete(itemMarkers).where(inArray(itemMarkers.itemId, itemIds));
  if (boxIds.length) await db.delete(boxMarkers).where(inArray(boxMarkers.boxId, boxIds));
  await db.delete(items).where(eq(items.moveId, moveId));
  await db.delete(boxes).where(eq(boxes.moveId, moveId));
  await db.delete(rooms).where(eq(rooms.moveId, moveId));
  await db.delete(statuses).where(eq(statuses.moveId, moveId));
  await db.delete(markers).where(eq(markers.moveId, moveId));
  await db.delete(photos).where(eq(photos.moveId, moveId));
  await db.delete(invites).where(eq(invites.moveId, moveId));
  await db.delete(members).where(eq(members.moveId, moveId));
  await db.delete(mutationLog).where(eq(mutationLog.moveId, moveId));
  await db.delete(moves).where(eq(moves.id, moveId));
}
```

Import `inArray, eq` from `drizzle-orm`. (If the harness DB supports `db.transaction`, wrap the body; D1 in tests typically does — check how other repos batch. If not available, the ordered deletes above are safe.)

**Step 4: Add the route** in `server/src/routes/moves.ts`, alongside the other owner-only handlers (after the `delete('/:id/members/:userId', …)` block), importing `deleteMove`:

```ts
r.delete('/:id', membershipMiddleware(deps), async (c) => {
  if (c.get('member').role !== 'owner') return c.json({ error: 'FORBIDDEN_ROLE' }, 403);
  await deleteMove(deps.getDb(c.env), c.req.param('id'));
  return c.json({ ok: true });
});
```

> Place it so it doesn't shadow more specific routes; Hono matches by registration but `/:id` is distinct from `/:id/...`. Keep it with the other `/:id` handlers.

**Step 5: Run tests**

Run (in `server/`): `npm test -- moves-delete`
Expected: PASS (3 tests). Then full `npm test` — the whole suite still green.

**Step 6: Commit**

```bash
git add server/src/repos/moves.ts server/src/routes/moves.ts server/test/moves-delete.test.ts
git commit -m "feat(server): owner-only DELETE /v1/moves/:id with cascade"
```

### Task 14: Client delete wiring

**Files:**
- Modify: `lib/api.ts` (add `deleteMove`)
- Modify: `store/useStore.ts` (a `deleteMove` action that does server teardown then local removal)
- Modify: `app/moves.tsx` (confirm dialog → call it)

**Step 1:** Add to `lib/api.ts` `api`:

```ts
deleteMove: (session: string, moveId: string) =>
  req<{ ok: true }>(`/v1/moves/${moveId}`, { method: 'DELETE' }, session),
```

**Step 2:** Add a store action `deleteMove(id)` that handles both modes:

```ts
deleteMove: async (id) => {
  const s = get();
  const b = id === s.currentMoveId ? extractSlice(s) : s.library[id];
  const isOwnedShared = b?.activeMode === 'shared' && b.serverMoveId && roleFor('shared', (b as SliceData).members, s.account?.id ?? null) === 'owner';
  if (isOwnedShared && s.session && b.serverMoveId) {
    try { await api.deleteMove(s.session, b.serverMoveId); } catch { /* fall through to local removal */ }
  }
  get().removeMoveLocal(id);
},
```

Add `deleteMove: (id: string) => Promise<void>;` to `Actions` and import `api` + `roleFor` (already imported). (Keep `removeMoveLocal` as the pure local drop from Task 4.)

**Step 3:** In `app/moves.tsx`, the Delete action uses `Alert.alert` confirm (owner-only; gate the menu item on `mode === 'local' || role === 'owner'`):

```tsx
Alert.alert('Delete move?', `“${name}” and its boxes will be permanently deleted.`, [
  { text: 'Cancel', style: 'cancel' },
  { text: 'Delete', style: 'destructive', onPress: () => { void useStore.getState().deleteMove(id); } },
]);
```

If the deleted move was current, `removeMoveLocal` clears it; route to `/moves` (already there) or `router.replace('/moves')`.

**Step 4: Typecheck → Commit**

```bash
git add lib/api.ts store/useStore.ts app/moves.tsx
git commit -m "feat: delete move (owner-only server teardown + local removal + confirm)"
```

---

## Phase 8 — Verification & finish

### Task 15: Full verification

**Step 1: Client**

Run (worktree root): `npm run typecheck && npm test`
Expected: typecheck clean; pure library tests green.

**Step 2: Server**

Run (in `server/`): `npm test`
Expected: full suite green, including `moves-delete`.

**Step 3: Manual smoke on simulator.** Launch per `memory/ios-dev-build-workflow` (Metro on **8082**, fmt/Xcode-26 fix, direct-launch). Walk the matrix:

- Fresh install → land on **Moves** empty state (no NYC mock).
- Create a move → empty boxes; add a box/item works; you're **owner** (full edit affordances).
- Create a 2nd move → switch between them (data intact both ways — the snapshot/hydrate path).
- Archive move #1 → drops to Archived; unarchive restores it.
- Delete a local move (confirm dialog) → gone.
- Share a move (passes the dormant billing gate) → become shared; member shows you as owner.
- Create an invite link; on a 2nd account/device open `organizard://invite?token=…` → joins as editor/viewer; role affordances reflect that (no owner-only controls).
- Owner deletes the shared move → gone on the server (2nd account loses access on next sync).
- No "Viewing as" toggle anywhere; no `GECKO-4F2` mock screen.

Record results. Fix any failures as their own TDD/typecheck-gated tasks.

### Task 16: Deploy the server + finish the branch

**Step 1: Deploy** the Worker so the delete endpoint is live (the client points at `https://organizard-api.aaditya-kv.workers.dev`):

Run (in `server/`): `npx wrangler deploy` — **confirm with the user before deploying** (outward-facing). Verify the deploy and that existing endpoints still respond.

**Step 2:** Use **superpowers:finishing-a-development-branch** to choose merge/PR/cleanup. Update `memory/multi-move-library.md` status if the model changed during implementation.

---

## Notes / risks

- **Data integrity on switch** is the #1 risk — it's why the snapshot/hydrate math is pure and tested (Phase 1). If a manual test ever shows a move losing data on switch, add a failing `library.test.ts` case first.
- **Hono route ordering:** register `delete('/:id')` with the other `/:id` handlers; it won't shadow `/:id/members/:userId`.
- **Snapshot `move.id`:** the server snapshot carries `move.id` even though the client `Move` type omits it (already relied on in `lib/share.ts`); cast locally as shown.
- **`onboarded`** is now vestigial (empty library is the first-run signal). Left in place to avoid churn; can be removed later.
- **Deploy gating:** the shared-move delete only works end-to-end after the Worker is redeployed (Task 16).
```
