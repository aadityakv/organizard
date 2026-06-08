# Organizard API (Cloudflare Worker)

The backend for **shared** Organizard moves. Solo/local moves never touch this —
see `docs/plans/2026-06-07-organizard-backend-design.md` for the full design.

**Stack:** Hono + Drizzle on Cloudflare Workers, over D1 (data), R2 (photos), KV (sessions).

## Scripts

```bash
npm run dev            # wrangler dev (local Miniflare: D1/R2/KV emulated)
npm test               # vitest (Hono app.request, no Miniflare needed)
npm run typecheck      # tsc --noEmit
npm run db:generate    # drizzle-kit generate -> ./drizzle/*.sql
npm run db:migrate:local  # apply migrations to the local D1
```

## Bindings (`wrangler.toml`)

| Binding | Service | Purpose |
|---|---|---|
| `DB` | D1 | moves / rooms / boxes / items / members / … |
| `PHOTOS` | R2 | item & box photos (shared moves) |
| `SESSIONS` | KV | session tokens + magic-link tokens |

> `database_id` / KV `id` are local placeholders. Before deploying, run
> `wrangler d1 create organizard` + `wrangler kv namespace create SESSIONS` and
> paste the real ids in.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/v1/auth/apple` · `/v1/auth/email/start` · `GET /v1/auth/email/verify` | sign in |
| GET | `/v1/me` | user + their moves |
| POST | `/v1/moves` | create shared move (**entitlement required**) |
| GET | `/v1/moves/:id` · `/v1/moves/:id/changes?since=` | snapshot · delta |
| POST | `/v1/moves/:id/mutations` | batch apply (role-checked, LWW, idempotent, owner-entitlement) |
| POST | `/v1/moves/:id/invites` · `POST /v1/invites/:token/accept` | sharing |
| PATCH·DELETE | `/v1/moves/:id/members/:userId` | owner only |
| POST | `/v1/moves/:id/photos` · `PUT·GET /v1/photos/:id` | R2 photos |
| POST | `/v1/webhooks/revenuecat` | entitlement sync |

## Deploy

```bash
wrangler d1 create organizard          # paste database_id into wrangler.toml
wrangler kv namespace create SESSIONS  # paste id into wrangler.toml
wrangler r2 bucket create organizard-photos
wrangler d1 migrations apply organizard --remote
wrangler secret put RESEND_API_KEY
wrangler secret put APPLE_BUNDLE_ID
wrangler secret put REVENUECAT_WEBHOOK_SECRET
wrangler deploy
```

## Status

**Complete (Phases 1–8):** auth, mutation/sync engine, sharing, photos, billing, hardening.
**24 tests passing.** See `docs/plans/2026-06-07-organizard-backend-design.md` for the full design.
