# Tuck (repo: `organizard`)

<p align="center">
  <img src="https://github.com/aadityakv/organizard/actions/workflows/ci.yml/badge.svg" alt="CI">
</p>

**An iOS app for organizing a physical move.** Create a move, add rooms, pack boxes
into rooms, list what's in each box (with photos, value, quantity, notes and handling
markers), and stick a QR label on every box. During the move, "which box is my X in?"
is answered by a search or a scan instead of a rummage.

Shipped to TestFlight and submitted to the App Store under the name **Tuck** (sloth
mascot). The repository, bundle id, URL scheme and API host keep the original
working name **Organizard**; that mismatch is deliberate and not something to "fix".

> Data hierarchy: **Move › Room › Box › Item.** Pack fast. Find anything. Share the load.

<p align="center"><img src="assets/icon.png" width="96" alt="Tuck app icon"></p>

---

## What it does

| Area | What you get |
|---|---|
| **Moves library** | Multiple moves per device (active / archived). Guests keep moves local-only; signed-in users have every move synced to their account and available across devices. |
| **Boxes** | Boxes grouped by room, status or value. Custom statuses and handling markers (Fragile, Open first, …). Cover photo per box. |
| **Capture** | Single-item capture (camera-first, multi-photo, value, quantity, note) and **Streaming Mode**: snap or *say* items in a row and a parser splits "two lamps, forty dollars" into name / qty / value. Speech is on-device via a small native module. |
| **Find** | Search across every item and box in the move, or scan a box's QR label to jump straight to its contents. |
| **Labels** | QR labels per box, printable as a PDF through the iOS share sheet. |
| **Sharing** | Invite collaborators to a move with Owner / Editor / Viewer roles. Permissions are enforced on the server; the client only hides affordances. |
| **Accounts** | Sign in with Apple or email/password, in-app account deletion, guest mode with migration of local moves on first sign-in. |

## Architecture

Two deployables in one repo, sharing one contract.

```
app/          expo-router screens (file-based navigation) — thin compositions
features/     per-screen pieces: sheets, hooks and styles, grouped by feature
components/   ui/ primitives · domain/ pieces that know boxes, rooms and roles · brand/ mark, upsell, auth
hooks/        generic React hooks (sheet form state)
store/        Zustand store (persisted to AsyncStorage), slices + selectors
services/     orchestration: auth, share/sync engine, photo upload, printing
lib/          pure helpers: api/ client · photos/ refs · voice/ parsing · qr/ codes and labels · money, text, routes
data/         client domain types and the starter statuses/markers
shared/       the client<->server contract: wire models + the Mutation union
modules/      local Expo native modules (Swift): address autocomplete, speech recognizer
plugins/      Expo config plugins applied on every prebuild
theme/        design tokens (colors, 12-hue box palette, type, spacing)
server/       Cloudflare Worker: Hono + Drizzle over D1, R2 for photos, KV for sessions
```

The layering rule: `lib/` is pure (safe to import from node-run tests); anything
that touches the network, native modules or the store lives in `services/`;
screens compose `features/`; `app/` holds only routes.

### Sync model

A move is either **local** or **synced**.

- **Local** moves never touch the network. Guests only ever have local moves.
- **Synced** moves apply every edit optimistically, then append a `Mutation` to an
  outbox. The outbox flushes to the Worker, which re-applies each mutation
  (role-checked, last-write-wins, idempotent by client id) and the client pulls
  deltas since its last sync timestamp. Photos upload separately to R2 and are
  swapped from local file refs to server ids once they land.
- Signing in **migrates** a guest's local moves up to the account. Signing out drops
  the synced copies from the device (they come back on the next sign-in) and keeps
  anything that was never synced.

The `Mutation` union in `shared/mutations.ts` is the single source of truth for what
the client may send and what the server will accept. `ROLE_REQUIRED` in the same
file drives server-side authorization.

### Client

- **Expo SDK 56** (React Native 0.85, React 19, New Architecture on), TypeScript strict.
- State lives in one Zustand store split into inventory, library and session
  concerns, with memoized selectors so React 19's `useSyncExternalStore` never sees a
  fresh reference per render.
- Native pieces that Expo doesn't ship (Apple Maps address autocomplete,
  `SFSpeechRecognizer`) are tiny local Expo modules in `modules/`, autolinked at
  prebuild. The `ios/` and `android/` folders are generated and gitignored; native
  tweaks go through config plugins in `plugins/`.

### Server

- **Hono** routes, **Drizzle** repositories, and a middleware layer for sessions and
  move membership. Everything that touches the outside world (database, clock, id
  generation, Apple token verification, email) goes through one injectable `Deps`
  object so the whole Worker is tested in-process without Miniflare.
- Public privacy and support pages are served by the same Worker so the App Store
  listing needs no extra hosting.

## Run it

```bash
npm install
npx expo run:ios            # prebuild + pod install + build for the simulator
```

Camera, QR scanning and speech need a real device (or a simulator with a camera).
Everything else runs anywhere.

```bash
cd server
npm install
npm run dev                 # wrangler dev with local D1 / R2 / KV emulation
```

The client's API URL is set in `app.json` under `expo.extra.apiUrl`.

## Environments

| APP_ENV | Backend | Used by |
|---|---|---|
| `production` | `organizard-api` Worker | `eas build --profile production` (default) |
| `staging` | `organizard-api-staging` Worker (`wrangler --env staging`) | the `development` and `preview` profiles |
| `local` | `http://localhost:8787` (`npm run dev` in `server/`) | set `APP_ENV=local` for a dev client |

`app.config.ts` maps the profile to the API URL; `server/wrangler.toml` defines both
Workers. Crash reporting is off unless `SENTRY_DSN` (and, for native symbolication,
`SENTRY_ORG` / `SENTRY_PROJECT`) are present at build time.

## Test and verify

```bash
npm run typecheck && npm run test:coverage   # client logic: tsc + vitest with coverage thresholds
npm run test:ui                              # client components: jest-expo + Testing Library
cd server && npm run typecheck && npm run test:coverage   # server: the full HTTP suite
```

The store is built by a factory that takes its storage backend, so the whole store
(slices, the delta merge, sign-out, the persist migration) runs in node against an
in-memory storage. Pure logic (voice parsing, photo refs, QR classification, the move
library) is unit tested the same way. Screens are verified on the simulator.

## Shipping

The Worker deploys from GitHub Actions (`deploy.yml`): every push to `main` that touches
`server/` or `shared/` runs the tests, applies D1 migrations and deploys production; the
manual trigger targets staging or production. It needs `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` as repository secrets. Server first, always: an old Worker
rejects mutation types a newer client sends.

iOS builds are made **locally** with `eas build --local` and uploaded with `xcrun altool`.

## License

All rights reserved (see `LICENSE`). The code is published for review; it is not
licensed for reuse.
