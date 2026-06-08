# Multi-move library — design

Date: 2026-06-08
Status: Approved (brainstorm), ready to plan

## Problem

The first TestFlight build behaves like the design *demo*, not the product:

- The store boots into mock data — the "NYC Move" seeded from `data/mockData.ts`
  (`store/useStore.ts` `initialState`). First launch drops you into a fully
  populated fake move you never created.
- Onboarding's "Continue with Apple" doesn't authenticate — it just advances a
  step (`app/onboarding.tsx`); "Create a move" / "Join a move" only flip an
  `onboarded` flag. Hence "I signed in automatically" — it was a no-op mock.
- The data model holds exactly **one** move, so there is no switch / create /
  delete anywhere.
- "Viewing as" is a demo toggle (`components/RoleSwitcher.tsx`, rendered at
  `app/(tabs)/index.tsx`) that fakes the role instead of deriving it.
- A second, fully-mock sharing UI lives at `app/(tabs)/members.tsx` (hardcoded
  invite `GECKO-4F2`), separate from the real `app/share.tsx`.

The agreed product is: **local moves are free and fully work; only *sharing* is
gated.** This design makes the local experience real and adds a proper library
of moves.

## Product model

A move sits on two independent axes:

- **Lifecycle** — *Active* (in your normal rotation) vs *Archived* (data kept
  for history, but not loaded into your face). Reversible.
- **Mode** — *Local* (free, offline) vs *Shared* (synced; gated on payment at
  the moment you choose to share). Unchanged from today.

Move actions:

- **Create / Join** — offered both at first-run onboarding *and* from the Moves
  home.
- **Share** — gated on payment. The gate already exists (`app/share.tsx` →
  `billingConfigured()` / server `ENTITLEMENT_REQUIRED`); billing is dormant
  now, so it passes through until billing is switched on.
- **Archive / Unarchive** — keep-the-data action; any move; reversible.
- **Delete** — **owner-only**, with an "Are you sure?" confirmation. Permanent.
  For a shared move you own, this tears the move down on the server too (new
  endpoint, below).

## Navigation & screens

- **Launch → your current move.** The app opens straight into the last-open
  non-archived move (its tabs). It does *not* force you through a list each
  time.
- **Moves home** (`/moves`) is one tap back (a "Moves" control in the dashboard
  header). It lists an **Active** section and a collapsed **Archived** section.
  Tap any move to switch into it; per-move actions: Archive/Unarchive, Delete
  (owner only, confirm). Buttons: **New move**, **Join move**.
- **First run / no current move** (fresh install, or you archived/deleted your
  last move) → land on the Moves home in its empty state, carrying the
  gecko/wordmark hero, with **Create a move** / **Join a move**. This replaces
  the old onboarding screen and its fake sign-in.
- Real Apple sign-in stays only where it already works: the **Share** gate (and
  now the Join flow, which needs a session).

## Data model (`store/useStore.ts`)

Minimize churn: keep the existing flat "active move" slice as the live working
copy, so every screen and action that reads `move`/`rooms`/`boxes`/`itemsByBox`
and the sync fields is unchanged. Add a library around it.

- New state:
  - `library: Record<string, MoveBundle>` — each bundle is a full move's data
    (`move`, `rooms`, `boxes`, `statuses`, `markers`, `members`, `itemsByBox`)
    *plus* its sync state (`activeMode`, `serverMoveId`, `outbox`, `lastSyncTs`)
    *plus* lifecycle meta (`archived: boolean`, `createdAt`, `lastOpenedAt`).
  - `currentMoveId: string | null` — which bundle is mirrored into the live
    slice.
- New actions:
  - `createMove({ name, from?, to?, target? })` → empty local move, becomes
    current.
  - `switchMove(id)` → `snapshotCurrent()` writes the live slice back into
    `library[currentMoveId]`, then hydrates the live slice from `library[id]`.
  - `archiveMove(id)` / `unarchiveMove(id)` → flip `archived`.
  - `deleteMove(id)` → drop the bundle (UI handles server teardown + confirm).
  - `addSharedMoveFromSnapshot(serverMoveId, snap)` → create a fresh shared
    bundle from a server snapshot and make it current (used by Join).
- New selector `moveSummaries(s)` → list rows: `{ id, name, from, to, target,
  mode, role, archived, boxCount, itemCount }`. The current move's summary is
  read from the live slice; the rest from `library`.
- The sync engine (`store/sync.ts`) is unchanged: it syncs only the *current*
  move (the live slice). Other shared moves sit dormant until switched in —
  consistent with owner-pays-to-share.

### Roles become real

Delete `role`/`setRole` from the store and the `RoleSwitcher` component. Add a
selector:

```
currentRole(s) = s.activeMode === 'local'
  ? 'owner'
  : (s.members.find(m => m.id === s.account?.id)?.role ?? 'viewer')
```

Replace `useStore((s) => s.role)` in `app/(tabs)/index.tsx`, `app/box/[id].tsx`,
and `app/add-item.tsx` with `currentRole`. `lib/permissions.ts` is unchanged.

### Migration (store version 2 → 3)

- If the persisted state is a shared move (`activeMode === 'shared'` &&
  `serverMoveId`), lift it into a bundle and keep it as `currentMoveId`.
- Otherwise (the seed/mock or a plain local move on a test device) reset to an
  **empty** library with `currentMoveId = null`, so the user starts clean and
  goes through Create/Join. Drops the NYC mock.
- Fresh installs no longer seed from `data/mockData.ts` — `initialState` starts
  with an empty library. (Mock data may stay in the repo for Storybook-style
  previews but is no longer wired into the store.)

## Join flow (client)

The server side already exists: `POST /v1/invites/:token/accept`
(`server/src/routes/invites.ts` → `api.acceptInvite`) returns a full snapshot.
Invite links are `organizard://invite?token=<token>` (custom scheme; the app's
scheme is already `organizard`). On-device taps work for TestFlight testing.

New route `app/invite.tsx`:

1. Read the `token` search param.
2. Ensure a session — if none, run real Apple sign-in (`signInWithApple`); fall
   back to the email path / a clear message if Apple is unavailable.
3. `api.acceptInvite(session, token)` → snapshot. Use `snap.move.id` as the
   server move id (the server snapshot carries it, as already relied on in
   `lib/share.ts`).
4. `addSharedMoveFromSnapshot(serverMoveId, snap)` → adds the bundle, makes it
   current, `router.replace('/(tabs)')`.
5. Friendly errors for `INVITE_INVALID` / `INVITE_USED` / `INVITE_EXPIRED`.

## Server: delete move

New owner-only endpoint, mirroring the existing member-management guards in
`server/src/routes/moves.ts`:

```
r.delete('/:id', membershipMiddleware(deps), async (c) => {
  if (c.get('member').role !== 'owner') return c.json({ error: 'FORBIDDEN_ROLE' }, 403);
  await deleteMove(deps.getDb(c.env), c.req.param('id'));
  return c.json({ ok: true });
});
```

- New repo fn `deleteMove(db, moveId)` in `server/src/repos/moves.ts` — cascade
  the move and all child rows (members, rooms, boxes, items, statuses, markers,
  invites, photos) via FK `on delete cascade` if present, else explicit deletes.
- Client: `api.deleteMove(session, moveId)`; the store `deleteMove` action calls
  it first for an owned shared move, then drops the local bundle. Local moves
  skip the server call.
- Tests in `server/test/sharing.test.ts` (or a new `moves.delete.test.ts`):
  owner can delete; editor/viewer get 403; non-member gets 404; child rows are
  gone afterward.
- Requires a Cloudflare Workers redeploy.

## Demo cleanup

- Remove `RoleSwitcher` from the dashboard and delete the component.
- Delete the mock `app/(tabs)/members.tsx`; the bottom **Share** tab renders the
  real share/members management (consolidate `app/share.tsx`'s content into the
  tab, or have the tab host it). Remove the hardcoded `GECKO-4F2` invite.
- Replace the old onboarding screen with the Moves-home empty state.

## Testing

- Server: delete-move endpoint tests (above), run the existing vitest suite.
- Client: `npm run typecheck`. Manual passes on simulator/TestFlight —
  create → switch → archive → unarchive → delete (local & shared owned); first
  run empty state; share (passes the dormant gate); join via
  `organizard://invite?token=…`; role affordances correct as local owner vs
  shared editor/viewer.

## Deferred / out of scope

- Universal (https) invite links + associated domains — custom scheme is enough
  for TestFlight.
- Background sync of non-current shared moves — only the current move syncs.
- Transferring ownership.
```
