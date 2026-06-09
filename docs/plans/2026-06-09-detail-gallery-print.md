# Item detail, box gallery, sort/search, move editing, label printing — Plan

> Execute via superpowers:subagent-driven-development. Verify on the iOS-26 sim before any TestFlight build.

**Goal:** Make items open a read-only **detail view** (edit is secondary), add a
collapsible **box photo gallery** with a full-screen viewer, **sort + in-box search**
for items, **edit the move** (name/from/to/date) + surface the target date, and real
**QR label printing**.

**Branch:** `detail-gallery-print` off `main` (build 8). No worktree (native print
module + avoid the node_modules symlink footgun).

**Stack reminders:** Expo SDK 56 / RN 0.85 / New Arch ON, expo-router, Zustand store
(`store/useStore.ts`), photos via `lib/photos.ts` (`photoSource`). Item edit lives in
`app/add-item.tsx` (edit mode via `?itemId`). Box detail is `app/box/[id].tsx`.
Register new routes in `app/_layout.tsx`. JS-only phases verify via Metro reload on the
installed dev app; the printing phase needs a native rebuild (`expo run:ios`).

---

## Phase 1 — Item detail view (keystone; everything links here)

- New route `app/item/[id].tsx`: **read-only** card for an item — photos (tappable →
  full-screen viewer), name, value, qty, notes, markers, and a Box #/Room breadcrumb
  (tappable → the box). An **Edit** button → `/add-item?boxId&itemId` (the existing
  edit form). A ⋯/Delete for owners/editors (reuse `deleteItem`). Role-aware (viewers
  read-only, no Edit).
- `app/box/[id].tsx`: change `ItemRow` tap to push `/item/[id]` (NOT the edit form).
- Register `item/[id]` in `app/_layout.tsx` Stack.
- Verify on sim: tap item → detail (not edit); Edit → form; back works.

## Phase 2 — Box photo gallery + full-screen viewer

- A "Photos" section on `app/box/[id].tsx`: a **collapsible** strip showing the box
  cover (if any) + every item photo in the box. Collapsed by default with a peek +
  count ("12 photos"); expand toggles the full strip/grid.
- Tapping any photo opens a **full-screen swipeable viewer** (new modal route, e.g.
  `app/gallery/[boxId].tsx` with an initial-index param, or a shared viewer). Each
  slide is labeled: **"Box photo"** or **"From: <item name>"**; the item label is
  tappable → `/item/[id]`. Tap/close button dismisses; use the existing
  gesture-handler for swipe/pinch (keep zoom simple).
- Build a helper that assembles the ordered photo list for a box: `[{ ref, kind:
  'box'|'item', itemId? , itemName? }]` from the box cover + `itemsByBox`.
- Also satisfies "tap an item photo → see it full size" (item detail photos open the
  same viewer).
- Verify on sim: gallery collapses/expands; viewer swipes + labels + item link works.

## Phase 3 — Sort + in-box search (box screen)

- Sort menu for the items list: **A–Z, value high→low, recently added**. Display-only
  (no data change); a small control/segmented above the items.
- **In-box search** field on `app/box/[id].tsx` — filters just this box's items by name
  (and marker label); result rows tap → `/item/[id]`. Distinct from the move-wide Find.
- Verify on sim with a box of several items.

## Phase 4 — Edit the move + surface the target date

- Store: add `updateMove(patch: { name?; from?; to?; target? })` — updates `s.move`
  locally; for shared moves enqueue an `updateMove` mutation (NEW — none exists). Add
  the mutation end-to-end: `shared/mutations.ts` (+ ROLE_REQUIRED `canEdit`),
  `server/src/validation.ts`, `server/src/mutations/apply.ts` (update the `moves` row),
  `KNOWN_MUTATION_TYPES`. (Local moves work without the server; the server bits are for
  shared.)
- UI: tap the move title in the dashboard header (`app/(tabs)/index.tsx`) → an
  **edit-move sheet** with Name (Input), From/To (`AddressField`), Target date
  (`DateField`). Also reachable from the "Your moves" row ⋯ menu (`app/moves.tsx`).
- Surface the target date: a chip in the dashboard header subtitle and on each
  `app/moves.tsx` row (e.g. "→ Jul 12"). Keep it tasteful.
- Server: apply migration? No schema change (moves table already has name/from/to/
  targetDate). Just the mutation handling. Deploy the Worker at ship time.
- Verify on sim (edit a move's fields; date shows).

## Phase 5 — Real QR label printing

- Add `expo-print` (official Expo module — confirm it builds on SDK 56) + `expo-sharing`
  if needed. Native rebuild.
- Generate a **PDF of QR labels**: build an HTML page (grid of cells: QR image + "Box
  #N", name, room) and `Print.printToFileAsync({ html })` → open the iOS print/share
  sheet (`Print.printAsync` or `Sharing.shareAsync`). For the QR image in HTML, render
  each box's QR to a base64 data URL (the app already uses `react-native-qrcode-svg` +
  `encodeBoxQR`; get its data URL via the lib's `toDataURL`/`getDataURL` callback, or a
  small QR→SVG/PNG path) and embed `<img src>`.
- Flow: a **"Print labels"** screen reachable from the dashboard — list boxes with
  checkboxes (default all) → "Print N labels" → PDF → print sheet. The box-detail
  button becomes **"Print label"** (just this box).
- Remove the fake `Alert` "Add to print sheet" and the **demo chips** on `app/(tabs)/
  scan.tsx` (the "Demo · tap a result" controls + DEMO_* usage).
- Verify on sim: print sheet opens with a real PDF of labels; scan still works.

---

## Phase 6 — Finish

Typecheck (root + server) + tests green; full sim regression; then
finishing-a-development-branch → merge to main → (with user's go) cut a TestFlight
build. If the Worker changed (updateMove mutation), deploy it first.
