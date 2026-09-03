# Architecture

How Tuck is put together, and the decisions behind the parts that are not obvious
from reading the code. For the day-to-day map of the repo, see the root README.

## 1. Domain

```
Move ─┬─ Room ─┬─ Box ─┬─ Item (qty, value, note, markers[], photos[])
      │        │       └─ cover photo
      │        └─ …
      ├─ Status   (Packing / Sealed / In transit / Unpacked + user-defined)
      ├─ Marker   (Fragile, Open first, … + user-defined)
      └─ Member   (owner | editor | viewer)
```

Every box has a stable `number` (used on the printed label) and a QR payload of
`tuck://box/<id>` (labels printed before the rebrand used `organizard://` and still
scan). Scanning resolves the id against the current move and lands on one of four
states: this move, another move, an unknown code, or a box you have no access to.

## 2. Two kinds of move

| | Local | Synced |
|---|---|---|
| Who | Guests, and any move created before signing in | Every move of a signed-in user |
| Where it lives | AsyncStorage only | Server (D1/R2) + a local cache |
| Network | Never | Outbox flush + delta pull |
| Collaborators | No | Invite by link with a role |

The store field `activeMode` (`'local' | 'shared'`) is what every write path checks.
A local move's actions mutate state and return. A shared move's actions mutate state
**and** call `enqueue`, which appends a `Mutation` to the outbox. Nothing else
differs, which is the property that keeps the two paths from drifting.

Transitions:

- **Sign in** migrates each local move up: create the move on the server, then send
  its whole history as one mutation batch. Sync is paused during the migration so a
  partial outbox cannot flush before the entities exist.
- **Sign out** flushes the outbox, drops synced moves from the device and keeps local
  ones. The synced moves are pulled again on the next sign-in.

## 3. The sync engine (`services/sync.ts`, `server/src/mutations/apply.ts`)

One pass, run on mount, foreground, reconnect, and a 15-second poll:

1. **Flush** the outbox to `POST /v1/moves/:id/mutations` in chunks of 200. A 400
   drops only that chunk (a poison or legacy mutation) so an offline session is never
   wedged. Transient errors back off exponentially up to a minute.
2. **Upload** any item or cover photos that still point at local files, then swap the
   local reference for the server photo id in the store.
3. **Pull** `GET /v1/moves/:id/changes?since=<lastSyncTs>` and merge, paging until the
   server says there is no more.

Server-side, every mutation is:

- **Role-checked** against `ROLE_REQUIRED` from `shared/mutations.ts`. The client hides
  buttons by role but that is UX only; the server is the authority.
- **Scoped**: references to rooms, boxes, statuses, markers and photos are verified to
  belong to the target move before they are written, so a crafted payload cannot
  reach across moves.
- **Last-write-wins** in apply order, with `updatedAt` stamped by the server clock.
- **Idempotent** by `clientId`: a mutation already in `mutation_log` is skipped, so
  retries after a lost response are safe.
- **Soft-deleted**: rows carry `deletedAt` so deletes travel through the same delta
  channel as edits.

`shared/mutations.ts` is the contract. Adding a mutation type means adding a union
member, a `ROLE_REQUIRED` entry, a store action that enqueues it, and a `case` in
`applyOne`. The server rejects unknown types, so the Worker must ship before a client
that sends a new type.

## 4. Accounts and sessions

- Sign in with Apple (identity token verified against Apple's JWKS) or email/password
  (PBKDF2 via WebCrypto, rate-limited per email and per IP). Both produce an opaque session token stored in
  KV and kept on the device in the keychain (`expo-secure-store`).
- The session token is restored **before the first screen renders**. Shared-move photos
  are server URLs that need the token in an `Authorization` header; an image that
  renders before the token arrives gets a 401 that iOS caches, and the photo never
  recovers. Gating app readiness on session restore closes that window.
- In-app account deletion removes the user, their sessions and the moves they own, as
  required by App Store guideline 5.1.1(v).

## 5. Client structure

- **Screens** in `app/` are expo-router routes. Large screens are composed from
  per-feature folders (`features/box/`, `features/dashboard/`, `features/add-item/`,
  …) that hold their sheets, hooks and styles, so the route file reads as a
  composition.
- **State** is one Zustand store persisted to AsyncStorage. It is assembled from
  slices (inventory, library, session/sync) and exposes selectors from
  `store/selectors.ts`. Selectors that build a new array or object per call must be
  wrapped in `useShallow` or computed with `useMemo` over stable slices; React 19
  otherwise throws "Maximum update depth exceeded". This has bitten three times and is
  the main reason new screens are verified on the simulator before shipping.
- **Photos** are copied out of the volatile cache directory into the document
  directory and stored as a relative, re-resolvable reference. Absolute cache paths do
  not survive a reinstall. Uploads use `FileSystem.uploadAsync`; `fetch(file://).blob()`
  throws on this React Native version.
- **Streaming Mode** turns a spoken phrase into an item. `lib/streamParse.ts` is a pure,
  order-independent parser ("two lamps forty bucks", "lamps x2 $40") with a unit test
  suite; `lib/dictation.ts` is the seam between the parser and the on-device
  `SFSpeechRecognizer` module.

## 6. Native and build decisions

- **New Architecture is on** and cannot be turned off on Expo SDK 56; the `app.json`
  flag is ignored by prebuild.
- `ios/` and `android/` are generated by `expo prebuild` and gitignored. Native changes
  go through config plugins in `plugins/`: one patches a `fmt` compile error under
  Xcode 26, one disables the debug-dylib split that breaks linking once first-party
  Swift is present.
- Small native needs are met with **local Expo modules** in `modules/` (Swift + a TypeScript
  entry) rather than third-party packages: Apple Maps address autocomplete
  (`MKLocalSearchCompleter`) and on-device speech recognition. Both degrade to a no-op
  where the module is absent.
- `@react-native-community/datetimepicker` ships a prebuilt Fabric component that is
  ABI-incompatible with SDK 56's prebuilt React Native, so the date picker is a small
  self-contained JS component.
- Printing uses "render to PDF, then the iOS share sheet". `expo-print`'s direct print
  blanks on every print after the first on iOS 16+.

## 7. Server structure

```
server/src/
  app.ts          composition root: createApp(overrides) wires routes with Deps
  deps.ts         injectable seam: db, clock, ids, Apple verify, email
  routes/         Hono routers per resource (auth, moves, invites, photos, webhooks, legal)
  middleware/     session auth, move membership + role
  repos/          Drizzle queries per aggregate (moves, users, sharing, photos, scope checks)
  mutations/      applyMutations: the server half of the sync contract
  db/             schema + client
  lib/            apple JWKS, password hashing, rate limiting, ids, sessions, email
```

Tests call `createApp({ ...testDeps })` and exercise it with `app.request`, so the
entire HTTP surface, including authorization and sync semantics, runs in-process
with an in-memory SQLite and fake KV/R2 in well under a second.

## 8. Shipping

1. Bump `ios.buildNumber` in `app.json`.
2. If the Worker or a migration changed: `wrangler d1 migrations apply <db> --remote`,
   then `wrangler deploy`. Server first, always.
3. `eas build --platform ios --profile production --local`, then validate and upload
   with `xcrun altool`. Cloud EAS builds are rejected by Apple for this SDK
   combination.
4. Poll App Store Connect until the build is `VALID`.
