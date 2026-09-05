# Unpack mode — design (2026-09-04)

The app stops at the "Unpacked" box status. Unpack mode completes the loop: at the new
place you scan (or open) a box, get a checklist of what is inside, tick items off as
they come out, and the box flips to Unpacked on its own when the last item is ticked.

## Decisions

- **Per-item state is real data, not a scratch checklist.** An item gains
  `unpackedAt: number | null`. It persists, syncs, and survives a reinstall or a second
  device. Two people unpacking the same box on two phones see each other's ticks.
- **One new mutation, intent-based:** `setItemUnpacked { id, boxId, on }`. Applying it
  twice is a no-op, like `setBoxMarker`. Requires `canEdit`.
- **Auto-flip is forward only.** Ticking the last item sets the box status to Unpacked.
  Un-ticking an item afterwards leaves the status alone; the status is the user's, and
  fighting it is worse than a stale label. "Mark box unpacked" ticks every remaining
  item and sets the status, so an empty box can be closed out too.
- **Rooms' `dest` finally earns its keep:** the unpack screen header reads
  "Kitchen → NYC kitchen" so you know where the box goes before you open it.
- **Viewers** see the checklist read-only. Editors and owners tick.

## Contract

- `shared/models.ts` Item: `unpackedAt?: number | null`.
- `shared/mutations.ts`: `setItemUnpacked` with `ROLE_REQUIRED` = `canEdit`.
- Server: `items.unpacked_at` column (migration 0006), zod case in `validation.ts`,
  `applyOne` case (checks `itemInMove`, sets `unpackedAt` to `now` or null, bumps
  `updatedAt` so the delta carries it), `toItem` in `repos/moves.ts` includes it.
- Client: `data/types.ts` Item gets `unpackedAt`, `mappers.ts` copies it, the share
  replay batch emits `setItemUnpacked` after `addItem` for ticked items.

## Store

- `setItemUnpacked(boxId, itemId, on)`: sets `unpackedAt` locally, enqueues the
  mutation, and when `on` leaves no un-ticked item in the box and the box is not
  already Unpacked, calls `setBoxStatus(boxId, 'unpacked')`.
- `unpackBox(boxId)`: `setItemUnpacked(on)` for each un-ticked item, then the status.
- Selector `unpackProgress(s, boxId) → { done, total }` (fresh object, useShallow).

## Screens

- New route `app/unpack/[boxId].tsx`, pieces in `features/unpack/`: header with box
  name and "Room → dest", progress bar and "3 of 7 unpacked", checklist rows (photo or
  glyph, name, qty, big check), a "Mark box unpacked" button, and a done state once the
  status is Unpacked.
- Box detail gets an **Unpack card** above Items: progress text plus a chevron into the
  screen. Item rows show a check when an item is unpacked.
- The scan result sheet for a box in this move gains a second action, **Unpack**, next
  to "Open box".
- `routes.unpack(boxId)`; copy in `copy/unpack.ts`.

## Shipping note

The Worker must deploy before a client with this build reaches users. An old Worker
rejects the unknown mutation type with a 400; the sync engine then retries the batch one
mutation at a time and drops the ones still rejected, so ticks on shared moves would be
silently lost (the box status change would still land). The deploy workflow runs on a
push to `main` touching `server/` or `shared/`; staging is migrated and deployed by hand.

## Out of scope

Load/deliver tracking ("last seen"), the move-day summary, sorting unpacked items to
the bottom of the box list, and any dashboard-level unpack progress.
