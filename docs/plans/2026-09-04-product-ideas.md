# Product ideas backlog (2026-09-04)

A brainstorm of ways to make Tuck better, grouped by the job each does for someone
mid-move. Each idea was checked against the codebase at build 17 so none of them
already exist. Not a commitment; a menu.

Status key: **done** = shipped, **next** = agreed direction, blank = idea only.

## Make Find actually find things — done 2026-09-04 (except photo-only naming)

Find is the app's core promise ("which box is my X in?"), and today it is a plain
case-insensitive substring match on item name and marker label
(`store/selectors.ts` `findItem`).

- **Fuzzy and synonym search.** Tokenize the query, match each token against item
  name, note and marker labels; tolerate small typos and plural/singular; a small
  synonym list for common household terms (xmas/Christmas, TV/television, couch/sofa).
- **Search notes.** Notes are not indexed at all today.
- **Room and status filters on Find.** "Fragile things still in the truck" is not
  answerable right now.
- **Photo-only items.** Streaming Mode already snaps photos. Let a user tap a photo
  later to name the item, or use on-device Vision text/object labels to suggest a name.

## Unpacking is half the move — Unpack mode done 2026-09-04 (see unpack-mode-design.md)

The app stops at the "unpacked" status. Rooms already carry a `dest` field that is
barely used.

- **Unpack mode per box.** Scan a box at the new place, get a checklist of its items,
  tick them off; the box flips to unpacked automatically. Needs one new mutation
  (item checked) so the sync path stays simple.
- **Load and deliver tracking.** A "last seen" per box (scanned onto the truck,
  scanned off) answers "did box 14 make it?" on moving day.
- **Move-day summary.** Counts by status, total declared value, boxes with no items,
  boxes with no photos. A `sealed` count selector already exists.

## Reduce the friction of packing

- **Duplicate box / templates.** "Same as box 12 but for the other bookshelf."
- **Bulk operations.** Multi-select boxes to set status, room or markers.
- **Recent items / suggestions.** Autocomplete item names from earlier in the move
  and from a small built-in list per room type.
- **Widget or Live Activity** with boxes packed vs total, and a lock-screen shortcut
  straight into Capture.

## Trust and safety of the data

- **Export.** CSV or PDF inventory with values and photos, for renters and insurance
  claims. Nothing in the repo exports today. The obvious first Pro feature.
- **Guest backup.** Guests are local-only with no backup. A "save to Files" JSON
  export and restore covers a lost phone mid-move.
- **Photo compression before upload.** No resize or quality step exists in
  `services/photos.ts`; R2 and the user's data plan carry full-resolution captures.

## Sharing

- **Activity feed per move.** Who added what. The server's mutation log already holds
  the data.
- **Viewer-friendly web page.** A read-only move view served by the Worker so a
  helper without the app can look up a box from its QR label.

## Engineering health

- Android is configured but unshipped. Either ship it or strip the dead targets.
- Coverage bars and dependabot were flagged as tradeoffs in the last polish pass;
  revisit once features settle.

---

## Design: Make Find actually find things (2026-09-04)

**Matching** moves out of `store/selectors.ts` into a pure `lib/search.ts`:

- Normalize (lowercase, strip accents and punctuation), tokenize on whitespace, and
  stem each token with a tiny English plural rule plus an irregular list
  (knives, shelves, dishes, boxes).
- Every query token must match somewhere in the document (AND across tokens). A token
  matches a document token exactly, as a prefix (type-ahead), through a small
  household synonym table (xmas/Christmas, TV/television, couch/sofa, ...) or with one
  typo for tokens of four letters or more (Damerau-Levenshtein). Each kind of match has
  a quality; the document score is the sum over query tokens of the best quality times
  the field weight.
- Items are indexed on name (highest weight), marker labels, note, box name and room
  name (lowest). Boxes on name and room name. Results are sorted by score, ties by the
  original order, and each hit says which fields matched so the UI can explain a hit
  that came from a note.

**Filters** (Find tab only): single-select room chips and status chips under the search
field. With a filter set and no query, the whole filtered set is listed, so "Fragile
things still in the truck" is a status chip plus the query "fragile". `IndexedItem`
gains `boxStatus` for this.

**UI**: the Find tab reuses `FindResults` instead of its own copy of the result rows.
Result rows show the item's first photo when there is one, and show the note line when
the match came from the note.

**Out of scope here**: Vision-based naming of photo-only items (needs a native module
and a device); marker chips as filters (markers already match through the query).
