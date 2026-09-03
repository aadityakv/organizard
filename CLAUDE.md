# Organizard — project guide for Claude

A high-level map of what this is, how we build and test, and the conventions that
matter. Not a line-by-line reference — when you need specifics, read the code.

## What it is & the goal

Organizard is an **iOS app for organizing a physical move**. You create a *move*,
add *rooms*, pack *boxes* into rooms, and list *items* inside boxes (with value,
quantity, notes, markers, and photos). Each box gets a QR label you can scan to jump
straight to its contents. The point is to make "which box is my X in?" answerable
during a stressful move.

Data hierarchy: **Move › Room › Box › Item**.

A move's nav (build 17) is **Boxes · Capture · Find** (`app/(tabs)/_layout.tsx`):
Capture is a free single-item verb (→ box picker → Add item), Find is item/box search
+ scan-to-find, Scan/Share are no longer tabs. **Streaming Mode** (Pro) is rapid capture
— snap/speak items, parsed by `lib/streamParse.ts`; voice is *simulated* until the
on-device mic native module lands. See the streaming-mode auto-memory.

**Product model (as of build 16):** account-based sync, Spotify-style. First launch
shows onboarding: **log in / sign up**, or **continue as guest**.
- **Guest** → moves are **local-only** on the device (fully offline, free).
- **Signed in** → every move is **synced to the account** (pushed to the server,
  cached locally for offline use, available across devices). Creating a move while
  signed in pushes it up; signing in **migrates** a guest's local moves up; signing
  **out drops the synced moves** from the device (re-pulled on next sign-in) and keeps
  local-only moves. *Sharing* is no longer what puts a move on the server — for a
  signed-in user the move is already synced, so "Share" just **invites** collaborators.
- Sign-in is **Sign in with Apple OR email/password** (account deletion in-app, per
  5.1.1(v)). Billing is **OFF** (everything free for now). Account UI lives on the
  Moves library (profile button → account sheet). Key code: `services/share.ts`
  (`shareMove`/`syncLocalMovesUp`/`flushAndSignOut`), `services/sync.ts` (`pullServerMoves`),
  store `signOut` (drops synced moves). See the email-auth auto-memory.

Currently iOS-only (shipped via TestFlight). Android targets exist in config but
aren't shipped; cross-platform code should degrade gracefully on Android, not break.

## Stack

- **Client:** Expo SDK 56 (React Native 0.85, React 19), expo-router (file-based),
  TypeScript. State in **Zustand** persisted to AsyncStorage. Path alias `@/*` → repo root.
- **Server:** Cloudflare Worker — **Hono** (routing) + **Drizzle** (ORM) over **D1**
  (SQLite), **R2** for photo blobs, **KV** for sessions. Lives in `server/`.
- **Sync:** local moves never touch the network. A *shared* move applies every
  mutation optimistically and queues it to an outbox; the Worker re-applies mutations
  (role-checked, last-write-wins, idempotent by client id) and the client pulls deltas.
  The mutation contract is the source of truth shared between client and server.

## How we build & run

- **New Architecture is ON and effectively mandatory** on this stack —
  `app.json` `newArchEnabled: false` is *ignored* by SDK 56's prebuild. Don't try to
  turn it off. (The iOS-26 dead-touch bug that prompted the SDK 52→56 upgrade was
  fixed by `react-native-screens`, not by disabling New Arch.)
- **`ios/` and `android/` are generated** by `expo prebuild` (gitignored). Native
  tweaks go through **config plugins** in `plugins/` (re-applied every prebuild), never
  by hand-editing the native projects. There are plugins for an Xcode-26 `fmt` compile
  fix and for disabling the debug-dylib split (which otherwise hits a SwiftUICore
  linker error once first-party Swift is present).
- **Custom native modules** live in `modules/<name>/` (autolinked local Expo modules:
  `expo-module.config.json` + a podspec + a Swift `Module` + a TS `index.ts`). Import
  `requireOptionalNativeModule` from `'expo'`. Example: the Apple Maps address
  autocomplete module (`MKLocalSearchCompleter`, free, no API key).
- **Run on the simulator** with `npx expo run:ios` (does prebuild + pod install +
  build). The first build re-downloads RN prebuilt artifacts and is slow.

## How we test & verify

- **Unit tests: `npm test`** at the root (vitest, covers the pure/testable modules)
  and in `server/` (vitest, full server suite). **`npm run typecheck`** in both. These
  must be green before shipping.
- The store is assembled by `store/createStore.ts` with an **injected storage**, so the
  whole thing (slices, delta merge, sign-out, persist migration) is unit-tested in node
  (`store/createStore.test.ts`). **Screens** are still verified on the **simulator**.
- **Simulator driving** uses XcodeBuildMCP `snapshot_ui` (screen hash + element tree)
  + `screenshot`. The MCP tap tool is NOT enabled here, so taps go through **`cliclick`
  with a deliberate press** (`dd:x,y w:150 du:x,y` — quick clicks don't register on the
  iOS-26 sim). Tapping is flaky and coordinate-based; don't rabbit-hole on it. When the
  UI is hard to drive, prefer **seeding AsyncStorage / deep-linking / temporary
  in-app diagnostic logs read back through Metro** to get ground truth.

### Working principle that matters most here

**Reproduce before you fix, and verify before you ship.** This project has a real
history of "fixes" that were plausible but wrong because they were never reproduced —
each one cost a TestFlight round-trip and trust. For any bug: get the actual evidence
(reproduce it, inspect real state/logs), confirm the root cause, then verify the fix
exercises the real failing path — *especially* for the shared/synced path, which
behaves differently from the local path. Be honest about what's verified vs. what only
the user's device can confirm. Use the systematic-debugging discipline; don't guess.

## Shipping to TestFlight

The full pipeline is documented in the auto-memory; the shape:

1. Bump `ios.buildNumber` in `app.json`.
2. **Build locally** (NOT EAS cloud — cloud is rejected by Apple, wrong SDK):
   `eas build --platform ios --profile production --local --output /tmp/Organizard.ipa`.
3. **Validate + upload via `xcrun altool`** (NOT `eas submit`); then poll App Store
   Connect until the build is `VALID`.
4. **If the Worker/D1 changed**, do the server side first: apply the prod D1 migration
   (`wrangler d1 migrations apply <db> --remote`), then `wrangler deploy`. An old Worker
   rejects unknown mutation types, breaking shared-move sync.

Git: work on `main` (or a short-lived branch), keep `main` pushed to the private
GitHub remote. Commit/push when the work is real and verified.

## Known gotchas (so we don't relearn them)

- **Zustand selector render-loops (has bitten 3×).** A `useStore((s) => ...)` selector
  that builds a **fresh object/array each call** (e.g. `findItem`, `moveSummaries`,
  `boxPhotos`, `allIndexedItems`) hands `useSyncExternalStore` a new reference every
  render → React 19 throws **"Maximum update depth exceeded"** and the screen crashes.
  Typecheck and code review do NOT catch this — only running it does. Fix: wrap in
  `useShallow` when the inner values are stable store refs, OR compute via `useMemo`
  over the stable slices it derives from (`useStore((s) => s.boxes)` etc.). Selectors in
  `store/selectors.ts` say in their doc comment which ones build fresh values. This is
  the #1 reason to verify new screens on the simulator before shipping.
- `newArchEnabled: false` is ignored — New Arch is always on (see above).
- `@react-native-community/datetimepicker` is **ABI-incompatible** with SDK 56's
  prebuilt RN (undefined Fabric symbols at link). We use a self-contained JS date
  picker instead. Be wary of any lib that ships a prebuilt Fabric component.
- **`fetch('file://…').blob()` THROWS on RN 0.85** ("Creating blobs from ArrayBuffer
  not supported"). To upload a local file, use `FileSystem.uploadAsync(url, fileUri,
  { uploadType: BINARY_CONTENT })` — never fetch→blob.
- Captured photos must be copied out of the volatile cache dir into the persistent
  **document directory** and stored as a relative, re-resolvable reference; absolute
  cache paths die on relaunch/reinstall.
- Don't commit `node_modules` symlinks (they slip past a trailing-slash gitignore and
  can clobber the main checkout on merge).

## Memory

Durable, non-obvious project facts (Apple/credential IDs, the TestFlight pipeline
details, billing/auth decisions, the SDK-56 migration story, native-build gotchas)
live in the auto-memory index and are loaded each session. Add to it rather than
re-discovering.
