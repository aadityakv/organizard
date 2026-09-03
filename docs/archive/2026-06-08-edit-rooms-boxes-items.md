# Edit Rooms, Boxes & Items — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (or executing-plans) to implement this plan task-by-task.

**Goal:** Make rooms, boxes, and items fully editable — including room color, moving
boxes between rooms and items between boxes, cascade room delete — and fix item
photos disappearing after an app refresh.

**Architecture:** The sync backend already implements update/delete for rooms, boxes,
and items; this is mostly client wiring (new store actions + edit UI) plus two
genuinely new pieces: a `color` field on rooms (full stack) and a `moveItem` mutation
(items between boxes). The photo bug is fixed by persisting captures to the document
directory and storing a re-resolvable reference.

**Tech Stack:** Expo SDK 56 / RN 0.85 / React 19, Zustand + AsyncStorage, expo-router,
expo-camera, expo-file-system (to add), Cloudflare Workers (Hono + Drizzle + D1), Zod,
Vitest.

**Working dir:** `.worktrees/edit-rooms-boxes-items` (branch `edit-rooms-boxes-items`).
Run unit tests with `npm test` (root) and `cd server && npm test`. Verify UI on the
iOS-26 simulator per the established workflow (XcodeBuildMCP `snapshot_ui` + `cliclick`
deliberate-press). `npm run typecheck` and `cd server && npm run typecheck` must pass.

---

## Phase A — Room color (full stack)

### Task A1: Add `color` to the Room model — shared, client, server schema, migration

**Files:**
- Modify: `shared/models.ts` (server `Room` type — add `color`)
- Modify: `data/types.ts:16-23` (client `Room` interface — add `color`)
- Modify: `store/mappers.ts:13` (`toClientRoom` — map `color`, default `'slate'`)
- Modify: `server/src/db/schema.ts:40-48` (`rooms` table — add `color` column)
- Create: `server/drizzle/0002_*.sql` (migration, via drizzle-kit generate)

**Step 1: Write the failing server test**

Add to `server/test/moves.test.ts` (or a new `rooms.test.ts`) a test that creates a
move, applies an `addRoom` with `color: 'teal'`, pulls the snapshot, and asserts the
room comes back with `color: 'teal'`; then applies `updateRoom { color: 'rose' }` and
asserts the delta carries `color: 'rose'`.

**Step 2: Run it — expect FAIL** (`color` not yet on the type/column).
Run: `cd server && npm test -- rooms` → FAIL.

**Step 3: Implement**
- `shared/models.ts`: add `color: string` to `Room`.
- `data/types.ts`: add `/** Box-palette hue name. */ color: string;` to `Room`.
- `store/mappers.ts`: `toClientRoom = (r) => ({ ..., color: r.color ?? 'slate' })`.
- `server/src/db/schema.ts`: add `color: text('color').notNull().default('slate'),`
  to the `rooms` table (after `icon`).
- Generate migration: `cd server && npm run db:generate` (creates `0002_*.sql` with
  `ALTER TABLE rooms ADD ...`; verify the SQL adds `color` with default `'slate'`).
  Apply locally for tests: `npm run db:migrate:local`.

**Step 4: Run server tests — expect PASS.** `cd server && npm test`.

**Step 5: Commit** — `feat(rooms): add color field to room model (shared/client/db)`.

### Task A2: Carry `color` through addRoom/updateRoom mutations + validators + apply

**Files:**
- Modify: `shared/mutations.ts:6-7` (addRoom + updateRoom payloads — add `color?`)
- Modify: `server/src/validation.ts:10-11` (add `color: str.optional()` to both)
- Modify: `server/src/mutations/apply.ts:48-60` (write `color` on insert + update)

**Steps (TDD):** The Task A1 test already exercises this path. Add `color?: string` to
the `addRoom` and `updateRoom` payloads in `shared/mutations.ts`; add
`color: str.optional()` to both Zod validators; in `apply.ts` `addRoom`, set
`color: p.color ?? 'slate'` on insert; in `updateRoom`, `if (p.color !== undefined)
set.color = p.color`. Run `cd server && npm test` → PASS. Commit:
`feat(rooms): sync color via addRoom/updateRoom mutations`.

---

## Phase B — Client store actions

### Task B1: `updateRoom` + `deleteRoom` (with cascade) store actions

**Files:**
- Modify: `store/useStore.ts` (Actions type + implementations, near `addRoom`)
- Test: `store/library.test.ts` (or new `store/useStore.test.ts`)

**Step 1: Write failing tests** for: `updateRoom(id, patch)` updates `rooms` in place
and enqueues an `updateRoom` mutation when shared; `deleteRoom(id)` removes the room
and **all its boxes + their items** from `boxes`/`itemsByBox`, and enqueues
`deleteRoom` + one `deleteBox` per box when shared.

**Step 2: Run — FAIL** (actions don't exist).

**Step 3: Implement** in `store/useStore.ts`:
```ts
updateRoom: (id, patch) => {
  set((s) => ({ rooms: s.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const payload = { id, ...patch }; // name?/dest?/icon?/color?
  get().enqueue({ type: 'updateRoom', clientId: uid('c'), ts: Date.now(), payload });
},
deleteRoom: (id) => {
  const boxIds = get().boxes.filter((b) => b.roomId === id).map((b) => b.id);
  set((s) => {
    const itemsByBox = { ...s.itemsByBox };
    for (const bId of boxIds) delete itemsByBox[bId];
    return {
      rooms: s.rooms.filter((r) => r.id !== id),
      boxes: s.boxes.filter((b) => b.roomId !== id),
      itemsByBox,
    };
  });
  for (const bId of boxIds) get().enqueue({ type: 'deleteBox', clientId: uid('c'), ts: Date.now(), payload: { id: bId } });
  get().enqueue({ type: 'deleteRoom', clientId: uid('c'), ts: Date.now(), payload: { id } });
},
```
Add both to the `Actions` type and the `updateRoom`/`deleteRoom`/`deleteBox` types are
already in `KNOWN_MUTATION_TYPES`.

**Step 4: Run tests — PASS.** `npm test`.

**Step 5: Commit** — `feat(store): updateRoom + cascade deleteRoom actions`.

### Task B2: `updateBox` store action (name / color / room)

**Files:** Modify `store/useStore.ts` (Actions type + impl near `addBox`); test in store test.

**Step 1: Failing test** — `updateBox(id, patch)` updates the box in `boxes` and
enqueues an `updateBox` mutation (shared).
**Step 3: Implement:**
```ts
updateBox: (id, patch) => { // patch: { name?; color?; roomId? }
  set((s) => ({ boxes: s.boxes.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  get().enqueue({ type: 'updateBox', clientId: uid('c'), ts: Date.now(), payload: { id, ...patch } });
},
```
**Step 5: Commit** — `feat(store): updateBox action (name/color/room)`.

### Task B3: `moveItem` — new mutation (server) + store action (item between boxes)

**Files:**
- Modify: `shared/mutations.ts` (add `moveItem` variant + `ROLE_REQUIRED.moveItem='canEdit'`)
- Modify: `server/src/validation.ts` (add `moveItem` Zod validator)
- Modify: `server/src/mutations/apply.ts` (handle `moveItem` — set `items.boxId`)
- Modify: `store/useStore.ts` (`KNOWN_MUTATION_TYPES` + `moveItem` action)
- Test: `server/test/*` and store test

**Step 1: Failing server test** — `moveItem { id, fromBoxId, toBoxId }` changes the
item's `boxId` (only if `toBoxId` is a box in the move); delta resends the item under
the new box.

**Step 3: Implement**
- `shared/mutations.ts`: `| { type: 'moveItem'; clientId: string; ts: number; payload: { id: string; fromBoxId: string; toBoxId: string } }` and `moveItem: 'canEdit'` in `ROLE_REQUIRED`.
- `server/src/validation.ts`: `z.object({ type: z.literal('moveItem'), clientId: str, ts: z.number(), payload: z.object({ id: str, fromBoxId: str, toBoxId: str }) })`.
- `server/src/mutations/apply.ts`:
```ts
case 'moveItem': {
  const p = m.payload;
  if (!(await itemInMove(db, moveId, p.id)) || !(await boxInMove(db, moveId, p.toBoxId))) return;
  await db.update(s.items).set({ boxId: p.toBoxId, updatedAt: now }).where(and(eq(s.items.id, p.id), eq(s.items.moveId, moveId)));
  return;
}
```
- `store/useStore.ts`: add `'moveItem'` to `KNOWN_MUTATION_TYPES`; add the action:
```ts
moveItem: (fromBoxId, toBoxId, itemId) => {
  set((s) => {
    const item = (s.itemsByBox[fromBoxId] ?? []).find((it) => it.id === itemId);
    if (!item) return {};
    return { itemsByBox: {
      ...s.itemsByBox,
      [fromBoxId]: (s.itemsByBox[fromBoxId] ?? []).filter((it) => it.id !== itemId),
      [toBoxId]: [...(s.itemsByBox[toBoxId] ?? []), { ...item, boxId: toBoxId }],
    } };
  });
  get().enqueue({ type: 'moveItem', clientId: uid('c'), ts: Date.now(), payload: { id: itemId, fromBoxId, toBoxId } });
},
```
Also update `applyChanges` dirty-tracking: add `case 'moveItem': dItem.add(p.id)`.

**Step 4: Run server + store tests — PASS.**
**Step 5: Commit** — `feat: moveItem mutation — move items between boxes`.

---

## Phase C — Fix item photos disappearing after refresh

> Follow superpowers:systematic-debugging. Reproduce + confirm root cause BEFORE the fix.

### Task C1: Reproduce on the simulator and confirm root cause

**Steps:**
1. Build/run the app on the iOS-26 sim (established workflow).
2. Create a local move → room → box → add item WITH a captured photo. Confirm it shows.
3. Force the failure: reload the JS (or relaunch the app) and/or inspect the persisted
   AsyncStorage value for the item's `photos[0]`. Confirm it's a `file://…/Caches/…`
   path, and that after reload the `<Image>` fails to render it.
4. Write down the confirmed root cause (expected: volatile cache-dir path persisted
   verbatim). If the evidence points elsewhere (e.g. an `expo-image`/RN `Image`
   regression from SDK 56, header/auth issue, or a remount key bug), STOP and
   re-scope the fix to the actual cause.

No commit (investigation only); record findings in the task notes.

### Task C2: Persist captures to the document directory; store a re-resolvable ref

**Files:**
- Add dep: `expo-file-system` (`npx expo install expo-file-system`)
- Modify: `lib/photos.ts` (persist helper + `isLocalUri` + `photoSource` + upload)
- Modify: `app/add-item.tsx` (persist on capture)
- Modify: `app/box/[id].tsx` `CoverSheet` (persist on capture)

**Design:** Introduce a stable local scheme so a saved photo is independent of the
container UUID and survives relaunches:
- `persistCapture(uri): Promise<string>` — copies the captured file into
  `${documentDirectory}photos/<uid>.jpg` and returns a sentinel ref `local:photos/<uid>.jpg`.
- `isLocalUri(p)` — also returns true for `p.startsWith('local:')` (so the sync engine
  still treats it as "needs upload", not a server id).
- `photoSource(photo, session)` — for `local:` refs, return
  `{ uri: documentDirectory + photo.slice('local:'.length) }`; for legacy `file://`
  refs, return as-is (back-compat); for server ids, the existing authenticated URL.
- `uploadPendingPhotos` — resolve a `local:` ref to its absolute path (via
  `photoSource`) before `fetch`-ing the blob to upload.

**Steps (TDD-ish):** Add a unit test in `lib/` or extend store test asserting
`photoSource('local:photos/x.jpg', null).uri` ends with `photos/x.jpg` and that
`isLocalUri('local:…')` is true. Then wire `add-item` `capture()` and `CoverSheet`
`capture()` to `await persistCapture(pic.uri)` before storing. Run `npm test`.

**Step: Commit** — `fix(photos): persist captures to documentDirectory (survive refresh)`.

### Task C3: Re-verify on the simulator

Repeat C1's repro: capture a photo → reload/relaunch → confirm the photo **still
shows** in the item row, box detail, and dashboard. Commit any follow-up. This task is
the verification gate for Phase C.

---

## Phase D — Editing UI

### Task D1: `RoomGlyph` component + use it everywhere a room icon shows

**Files:**
- Create: `components/RoomGlyph.tsx`; export from `components/index.ts`
- Modify: `app/(tabs)/index.tsx` (group header, breadcrumb, room picker chips)
- Modify: `app/box/[id].tsx` (leading `roomGlyph`)

**Spec:** `<RoomGlyph icon color size? />` renders a rounded square
(`borderRadius: radius.md`) filled with `boxTint(color)`, containing `<Icon
name={icon} color={boxColor(color)} />`. Replace the bare `<Icon name={room.icon}>`
usages in the dashboard group header (`index.tsx:599`), the breadcrumb
(`index.tsx:186-191`, small size), the room-picker chips (`index.tsx:331`), and the
box-detail leading glyph (`box/[id].tsx:156-159`). Verify on sim. Commit:
`feat(ui): RoomGlyph colored tile`.

### Task D2: Edit-room sheet (dual create/edit) + color picker + cascade delete

**Files:** Modify `app/(tabs)/index.tsx` (`AddRoomSheet` → `RoomSheet` with optional
`room` prop; make the dashboard group header pressable to open it in edit mode).

**Spec:**
- Generalize `AddRoomSheet` to accept an optional `room?: Room`. Title "New room" vs
  "Edit room". Prefill name/dest/icon/**color** when editing. Add a **Color** field: a
  `ColorDot` row over `BOX_COLORS` (same control as boxes), bound to a `color` state.
- On save: `addRoom({ name, dest, icon, color })` (create) or
  `updateRoom(room.id, { name, dest: dest||null, icon, color })` (edit).
- Edit mode shows a **Delete room** button. On press, compute boxes-in-room; if zero,
  confirm + `deleteRoom`. If >0, show the cascade `Alert` naming box + item counts;
  gate to owner (`PERM.canDelete(role)`) and on confirm call `deleteRoom` (which
  cascades). Update `addRoom` default in store to pass color.
- Wire the dashboard room group header (`index.tsx:597-611`) to be a `Pressable` that
  opens the sheet for that room (Owner/Editor only).
- Verify on sim (edit name/icon/color persists; delete with boxes warns + cascades).
- Commit: `feat(ui): edit & delete rooms with color`.

### Task D3: Edit-box sheet (name / color / room) from the box ⋯ menu

**Files:** Modify `app/box/[id].tsx`.

**Spec:**
- Add a `'edit'` sheet variant. The `onMore` menu gains **Edit box** (available to
  `canEdit`, not just owner); keep **Delete box** (owner-only) below it. If only
  `canEdit` (not delete), the trailing `⋯` still shows for Edit.
- `EditBoxSheet`: Name `Input`, Color `ColorDot` row, and a **Room** picker (reuse the
  room-pick chip pattern from `index.tsx`, each chip a `RoomGlyph` + name). On save:
  `updateBox(box.id, { name, color, roomId })`. Changing room = move between rooms.
- Verify on sim (rename, recolor, reassign room — box appears under the new room on the
  dashboard). Commit: `feat(ui): edit box name/color/room`.

### Task D4: Item editing — tap an item; add-item screen in edit mode

**Files:** Modify `app/box/[id].tsx` (`ItemRow` → pressable), `app/add-item.tsx`
(accept `itemId`; edit mode).

**Spec:**
- `ItemRow` becomes a `Pressable` (Owner/Editor) → `router.push({ pathname:
  '/add-item', params: { boxId, itemId: it.id } })`.
- `add-item.tsx`: read optional `itemId`. When present, it's **edit mode**:
  - Prefill `name/value/qty/note/photos/selectedMarkers` from the item.
  - Header title/label reflects editing; CTA row becomes a single **Save** (calls
    `updateItem(boxId, itemId, { name, value, qty, note, markers })` and, if photos
    changed, persist new captures and `updateItem` photos) instead of "Save & add
    another".
  - Add a **Move to another box** control (a box picker; on change call
    `moveItem(boxId, newBoxId, itemId)` and update the route's boxId or pop back).
  - Add a **Delete item** action (confirm → `deleteItem(boxId, itemId)` → back).
  - Photos: full add / remove already exist in the capture UI; ensure removed photos
    are written through on Save (and, for shared moves, that server-id photos can be
    removed — keep simple: update `item.photos` to the new array).
- Keep create mode (no `itemId`) exactly as today.
- Verify on sim (edit name/value, add+remove a photo, move item to another box, delete).
- Commit: `feat(ui): edit, move & delete items (reuse add-item screen)`.

---

## Phase E — Verify & finish

### Task E1: Full typecheck + tests + simulator regression

**Steps:**
- `npm run typecheck` and `cd server && npm run typecheck` → 0 errors.
- `npm test` (root) and `cd server && npm test` → all green.
- Simulator full-flow pass: create→edit→move→delete for room/box/item; room colors
  render; photo survives a reload. Use the iOS-26 sim per the established workflow.

### Task E2: Finish the branch

Use **superpowers:finishing-a-development-branch**. Do NOT merge to `main` (which
lacks the SDK-56 fix) — this branch sits on `upgrade-sdk-56`. Options: merge into
`upgrade-sdk-56`, or keep as-is pending the user's device verification of build 5 and a
new TestFlight build that bundles both. Bump `app.json` `buildNumber` and cut a
TestFlight build only when the user asks.

## Notes / risks

- **expo-file-system API (SDK 56):** the package split a new vs legacy API. Confirm the
  correct import for `documentDirectory` + `copyAsync`/`makeDirectoryAsync` (legacy
  import may be needed). Verify the `photos/` dir is created before copy.
- **Drizzle migration:** `db:generate` must produce exactly one `ALTER TABLE rooms ADD
  color …` migration; the deployed D1 needs `wrangler d1 migrations apply organizard`
  (remote) at ship time — note for the user, don't run remote migrations unprompted.
- **Permissions:** room cascade-delete gated to owner (consistent with box delete);
  empty-room delete allowed for editors.
- UI layers are verified on the simulator (no RN render-test harness here), consistent
  with this project's established practice.
