# Organizard — Backend & Sync Design

**Status:** Approved design (pre-implementation)
**Date:** 2026-06-07
**Context:** The Organizard iOS app (Expo / React Native) is built and local-first.
This document designs the backend that turns it into a shareable, multi-user app —
on a **Cloudflare-only** stack, with a **freemium model where solo is free and
sharing is paid**.

---

## 1. Summary

Organizard stays **local-first**. Every move is either:

- **Local move** — device-only, no account, fully offline, **free**. Photos stored
  on-device. Zero backend, zero marginal cost. (This is the app as already built.)
- **Shared move** — synced to Cloudflare (D1 + R2), has members + Owner/Editor/Viewer
  roles. Created by **upgrading** a local move via "Share / invite." The **owner pays**
  (Apple subscription); **invited partners join free**.

The backend is **one Cloudflare Worker** (Hono + Drizzle) over **D1** (data), **R2**
(photos), **KV** (sessions / tokens). The client and server speak through a single
**batch "mutation" endpoint** that powers optimistic UI, an offline outbox, and light
polling at once — no CRDTs.

Cost aligns with revenue: you only pay Cloudflare for shared moves, which is exactly
when the owner is paying you. Both sit comfortably in Cloudflare's free tier for a long
time.

---

## 2. Key decisions

| Decision | Choice | Why |
|---|---|---|
| Hosting | Cloudflare only (no Supabase) | User has a CF plan; primitives cover all of it |
| Tiering | Solo free & unlimited; **owner pays to share**; invitees free | Cost ↔ revenue aligned; keeps sharing viral |
| Move modes | Per-move `local` \| `shared` | Solo needs no backend; sharing is the upgrade |
| Auth | **Apple sign-in + email magic link** | iOS-native speed + reach for non-Apple invitees |
| Freshness | Optimistic writes + **~15s polling** (+ pull/open) | Feels fresh without WebSockets; cheap |
| Offline | **Optimistic + outbox**, last-write-wins | Resilient on flaky wifi; no CRDT complexity |
| Billing | **Apple IAP via RevenueCat**; Worker checks entitlement | App Store requires IAP for in-app features |
| API shape | Single **batch mutation** endpoint + delta sync | One pattern → optimistic + offline + polling |
| Server framework | **Hono** | Tiny, fast, built for Workers |
| Data access | **Drizzle ORM** on D1 | Typed queries + migrations; ~zero runtime cost |

### Deferred to v2 (explicitly out of scope now)
Real-time live updates (Durable Objects + WebSockets), Android (Google Play billing —
RevenueCat already abstracts it), full offline-first CRDT conflict resolution, QR-label
PDF generation.

---

## 3. Architecture

```
┌────────────── Expo / React Native app ──────────────┐
│  Local moves  →  AsyncStorage + expo-file-system    │   (free, offline, no account)
│  Shared moves →  same cache + Sync engine           │
│                    │  outbox (mutations)            │
│                    │  delta pull (~15s / on focus)  │
└────────────────────┼────────────────────────────────┘
                     │ HTTPS  (Bearer session)
              ┌──────▼─────── Cloudflare Worker (Hono) ───────┐
              │  middleware: auth · membership · entitlement  │
              │  routes: /auth /moves /mutations /changes     │
              │          /invites /members /photos /webhooks  │
              └───┬───────────────┬───────────────┬───────────┘
                  │ Drizzle       │ presign       │ session/token
              ┌───▼───┐       ┌───▼───┐       ┌───▼───┐
              │  D1   │       │  R2   │       │  KV   │
              │ data  │       │photos │       │sess.  │
              └───────┘       └───────┘       └───────┘
   external: Apple (token verify) · Resend (email) · RevenueCat (IAP webhook)
```

**Repo layout** (monorepo in this same repo):

```
/ (app)              existing Expo app
  app/ components/ theme/ store/ lib/ data/
  store/sync/        NEW — sync engine, outbox, mutations applier (client)
/server              NEW — Cloudflare Worker
  src/
    index.ts         Hono app + route mounting
    middleware/      auth, membership, entitlement
    routes/          auth, moves, mutations, invites, members, photos, webhooks
    db/              Drizzle schema + migrations
    mutations/       server-side mutation appliers + role map
  wrangler.toml
  drizzle.config.ts
  package.json
/shared              NEW — types + zod schemas imported by BOTH sides
  mutations.ts       discriminated union of mutation types + role requirements
  models.ts          Move/Room/Box/Item/... shapes
```

`/shared` is the anti-drift contract — the client and Worker import the same mutation
and model types.

---

## 4. Move modes & the upgrade flow

State refactor: the client store moves from **a single move** to **a list of moves**,
each tagged `mode: 'local' | 'shared'`. The dashboard gains a move switcher with a
`Local` / `Shared` badge.

**Local move:** persisted only in AsyncStorage; photos via `expo-file-system` (local
URI on the item); the sync engine is inert.

**Upgrade — tapping "Share / invite" on a local move:**
1. **Paywall** — if the `sharing` entitlement is inactive, present the RevenueCat
   paywall → purchase.
2. **Sign in** if needed (Apple / email link) → account + session.
3. **Migrate** — `POST /v1/moves` creates the shared move; the client replays the
   entire local move as one ordered mutation batch (rooms → statuses → markers →
   boxes → items) and uploads each local photo to R2, rewriting local URIs → `photoId`.
4. Move flips to `shared`; sync engine activates; an invite link is minted.

**Invitee:** signs in (free, no subscription), accepts the invite, the move syncs down;
their role gates affordances (server-enforced).

**Subscription lapse:** the owner's shared moves become **read-only** (data retained)
until renewed.

---

## 5. Data model (D1 / Drizzle)

Conventions: every mutable row has `updated_at` (ms, integer) and nullable `deleted_at`
(tombstone, so deletes sync). Money is **integer `value_cents`**. IDs are UUID strings
(client may generate them so optimistic local rows keep their id after sync).

```
users(id, apple_sub?, email?, name, avatar_color, entitlement_active, entitlement_expires_at, created_at)
moves(id, name, from_addr?, to_addr?, target_date?, owner_id, created_at, updated_at)
members(id, move_id, user_id, role['owner'|'editor'|'viewer'], created_at)   UNIQUE(move_id,user_id)
rooms(id, move_id, name, dest?, icon, updated_at, deleted_at?)
statuses(id, move_id, label, color, custom, updated_at, deleted_at?)         -- 4 defaults seeded per move
markers(id, move_id, label, color, icon, custom, updated_at, deleted_at?)
boxes(id, move_id, room_id, number, name, color, status_id, cover_photo_id?, updated_at, deleted_at?)
items(id, move_id, box_id, name, qty, value_cents, note?, icon?, updated_at, deleted_at?)
box_markers(box_id, marker_id)            -- join
item_markers(item_id, marker_id)          -- join
photos(id, move_id, item_id?, box_id?, r2_key, width?, height?, created_by, created_at)
invites(id, move_id, role, token, created_by, expires_at, accepted_by?)
sessions  -- in KV: token -> {userId, expires}   (not D1)
```

Everything is **move-scoped**, so one membership check authorizes the whole subtree,
and delta sync is `WHERE move_id = ? AND updated_at > ?` across these tables.

---

## 6. API surface + auth

All JSON under `/v1`. Auth = Bearer **session token** (opaque, KV → userId), stored in
`expo-secure-store`. Middlewares: `auth`, `membership` (loads caller's role for
`:moveId`), `entitlement`.

**Auth**
- `POST /v1/auth/apple {identityToken}` — verify Apple JWT (issuer Apple, audience =
  bundle id) → upsert by `apple_sub` → session.
- `POST /v1/auth/email/start {email}` — single-use token in KV (15-min TTL), email a
  deep link (`organizard://auth?token=…`) via **Resend**.
- `GET /v1/auth/email/verify?token=…` — upsert by email → session.
- `GET /v1/me` → user + shared moves. `POST /v1/auth/logout` → revoke session.

**Data** (require `auth` + `membership`; role enforced per mutation)
- `POST /v1/moves` *(entitlement)* → create shared move, seed default statuses, owner membership.
- `GET /v1/moves/:id` → full snapshot.
- `GET /v1/moves/:id/changes?since=ts` → delta (changed rows incl. tombstones) + server time.
- `POST /v1/moves/:id/mutations` → ordered `mutations[]`; per-mutation role check; LWW; returns versions.
- `POST /v1/moves/:id/invites {role}` *(owner)* → `{token, url}` · `POST /v1/invites/:token/accept`.
- `PATCH /v1/moves/:id/members/:userId {role}` *(owner)* · `DELETE …/members/:userId` *(owner)*.
- `POST /v1/moves/:id/photos` → `{photoId, uploadUrl}` (presigned R2 PUT) ·
  `GET /v1/photos/:id` → 302 to signed R2 URL (membership-checked).
- `POST /v1/webhooks/revenuecat` (authenticated) → update entitlement.

---

## 7. Mutation & sync engine

**Mutations** are a discriminated union in `/shared/mutations.ts`, each
`{ type, payload, clientId, ts }` with a declared role requirement:

```
addRoom updateRoom deleteRoom
addBox updateBox deleteBox setBoxStatus setBoxCover toggleBoxMarker
addStatus addMarker
addItem updateItem deleteItem
```

Role map (server): any add/update/delete on rooms/boxes/items/statuses/markers →
`canEdit` (owner|editor); member management + box delete → `owner`.

**Client store becomes a synced store:**
- Each user action (a) applies to local cache immediately, and (b) appends a mutation
  to a **persisted outbox**.
- Sync loop: flush outbox → `POST …/mutations` (idempotent via `clientId`) → drop
  acked → pull `…/changes?since=lastSyncTs` → merge **LWW** (server authoritative,
  except still-pending local outbox rows). Triggers: app open, screen focus, ~15s
  poll while focused, debounced after a mutation, and on reconnect (NetInfo).
- **Local moves** skip the loop entirely.

Server applier: validate role → upsert row with `updated_at = now` (LWW) → return
applied versions. Idempotency: a processed `clientId` is a no-op.

---

## 8. Billing & entitlements

Apple IAP via **RevenueCat** (`react-native-purchases`; requires a **custom dev
client**, not Expo Go). One `sharing` entitlement. On "Share this move," gate on
`entitlements.active['sharing']`; else show paywall.

**Server trust:** RevenueCat **webhook** → `POST /v1/webhooks/revenuecat` (verify auth
header) → set `users.entitlement_active` + `entitlement_expires_at`. The `entitlement`
middleware checks it for `POST /moves` and owner actions. Lapse → shared moves go
read-only (`ENTITLEMENT_REQUIRED`), data retained. Only owning/creating a shared move
is gated; invitees and solo are free.

---

## 9. Photos & R2

- **Local move:** `expo-file-system` document dir; local URI; never uploaded.
- **Shared move:** capture → optimistic local URI → `POST …/photos` → **PUT straight to
  R2** (presigned; Worker doesn't proxy bytes) → set `photoId`; local file kept as cache.
- **Display:** `photoId` → `GET /v1/photos/:id` → 302 → signed R2 URL; `expo-image`
  disk-caches. Membership checked at redirect.
- Downscale before upload (quality ~0.6, ≤1600px). Keys `moves/<moveId>/<photoId>.jpg`.
  R2 has **no egress fees** → serving partners is free.
- Upgrade migration uploads all local photos and rewrites their items.

---

## 10. Security

- Roles + membership enforced **server-side on every mutation** (client gating is UX only).
- Apple JWT signature verified; sessions opaque, TTL'd, revocable.
- Magic-link tokens single-use + short TTL.
- R2 private — signed URLs only, membership-checked.
- RevenueCat webhook authenticated; entitlement checked server-side, never trusted from client.
- Move-scoping = one membership check authorizes the subtree.

---

## 11. Error handling

Typed codes: `UNAUTHENTICATED`, `FORBIDDEN_ROLE`, `ENTITLEMENT_REQUIRED`, `CONFLICT`,
`NOT_FOUND`, `INVITE_INVALID`. Client mapping:
- `FORBIDDEN_ROLE` → existing `LockNote` pattern.
- `ENTITLEMENT_REQUIRED` → paywall.
- network / 5xx → stay optimistic, outbox retries with exponential backoff + jitter.
- Idempotent `clientId` means retries never double-apply.

---

## 12. Testing

- **Worker:** Vitest + **Miniflare** (local D1/R2/KV). Cover: auth (Apple verify mocked,
  magic-link), role enforcement (viewer can't mutate, editor can't manage members, only
  owner deletes), invite/accept, mutation batch + LWW + idempotency, entitlement gate,
  photo upload-url + access control.
- **Client:** sync-engine units (outbox flush, delta merge, local→shared migration);
  reuse existing `tsc --noEmit` + `expo export` bundle check.

---

## 13. Rollout & environments

- Drizzle migrations via `drizzle-kit`; `wrangler dev` (emulated D1/R2/KV) for local,
  `wrangler deploy` to prod.
- Secrets via `wrangler secret`: Apple keys/bundle id, Resend API key, RevenueCat
  webhook secret.
- `staging` + `production` environments in `wrangler.toml` (separate D1/R2/KV bindings).
- Lands incrementally behind the "Share" feature — the local-only app already ships.

---

## 14. Phased implementation plan

1. **Scaffold `/server` + `/shared`** — Hono Worker, wrangler.toml, Drizzle schema +
   first migration, `/v1/health`. Local `wrangler dev`.
2. **Auth** — Apple verify + email magic link (Resend), sessions in KV, `/me`.
3. **Moves + mutation engine** — create move, snapshot, `changes`, batch `mutations`
   with server role map + LWW + idempotency. Vitest coverage.
4. **Client sync engine** — multi-move store refactor, outbox, sync loop, NetInfo,
   `local | shared` modes (sync inert for local).
5. **Sharing** — invites + accept, members management, the local→shared **migration**.
6. **Photos/R2** — presigned upload, signed display, on-device downscale, migration upload.
7. **Billing** — RevenueCat integration, paywall on "Share," webhook + entitlement gate,
   lapse → read-only.
8. **Harden** — error codes end-to-end, retries/backoff, security review, e2e of the
   full upgrade + collaborate flow.

(v2 backlog: real-time via Durable Objects, Android/Google Play, offline CRDT, QR PDF.)
