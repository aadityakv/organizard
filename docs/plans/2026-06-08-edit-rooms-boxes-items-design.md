# Edit rooms, boxes & items — Design

**Date:** 2026-06-08
**Branch:** `edit-rooms-boxes-items` (off `upgrade-sdk-56`)

## Problem

The app can *create* rooms, boxes, and items but can't *edit* them. Users want to
change a room's name/destination/icon, a box's name/color/room, and an item's
name/value/qty/note/markers/photos — and to move boxes between rooms and items
between boxes. Rooms are also hard to tell apart (only ~12 icons), so rooms gain a
**color**. Separately, an item photo disappears after the app is refreshed.

## What already exists (important)

The sync backend **already implements** `updateRoom`, `deleteRoom`, `updateBox`,
`updateItem`, and `deleteItem` — contract (`shared/mutations.ts`), Zod validators
(`server/src/validation.ts`), server apply (`server/src/mutations/apply.ts`), and
role checks (`ROLE_REQUIRED`). The client just never grew the store actions or UI
to drive them. So most of this work is **client wiring**, not new backend.

## Decisions

- **Room color = colored icon tile.** The room icon sits in a rounded square filled
  with the hue's soft `tint`, icon drawn in the `solid` hue. Most differentiable;
  reads like a small logo. Rendered by a new `RoomGlyph` component used everywhere a
  room icon appears (dashboard headers, box-detail leading glyph, breadcrumb, room
  pickers). Palette = the existing 12-hue `boxPalette`. Default hue: `slate`.
- **Move boxes between rooms** — already supported by `updateBox.roomId` (no server
  work). Exposed via the Edit-box sheet's room picker.
- **Move items between boxes** — genuinely new: the server `updateItem` does not
  change `boxId`. Add a small `moveItem { id, fromBoxId, toBoxId }` mutation
  (canEdit). Exposed via the item editor's box picker.
- **Delete a room = cascade with a named warning.** Deleting a room also deletes its
  boxes and their items, behind a confirmation that names the counts ("removes this
  room, its 3 boxes, and 14 items — can't be undone"). Implemented client-side by
  enqueueing `deleteRoom` + a `deleteBox` per box (the server `deleteBox` already
  tombstones the box's items). Permission: empty-room delete = canEdit; cascade
  delete (has boxes) = owner, mirroring box-delete being owner-only.
- **Item editing reuses the `add-item` screen** in an edit mode (prefill, CTA "Save"
  vs "Add", + Move-to-box + Delete), so create and edit stay in lockstep. Full photo
  management: add / remove multiple photos.

## Photo-disappears-after-refresh (bug)

**Leading hypothesis (to confirm on the sim first):** `takePictureAsync` returns a
`file://` path inside the app's **cache** directory. We persist that absolute path
verbatim in `item.photos`. iOS changes the container-UUID path segment on reinstall
and may purge the cache dir, so after a refresh the path is dead and the image
fails silently. **Fix (pending repro):** copy each capture into the persistent
**document directory** (`expo-file-system`), store a stable re-resolvable reference
(a `local:`-scheme relative path), and resolve it at render time in `photoSource`.
For shared moves the existing upload→server-id path already makes photos durable;
this fixes the local case. Reproduce → confirm root cause → fix → re-verify.

## Out of scope

Reordering rooms/boxes/items, bulk edit, editing statuses/markers beyond what exists,
per-item color (items already inherit box color). Photos for purely-local moves still
cannot survive an app *uninstall* (the sandbox is wiped) — only relaunches/updates.
