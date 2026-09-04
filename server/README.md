# Tuck API (Cloudflare Worker)

The backend for **synced** moves. Local moves never touch this. The sync model is described in the root README.

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
| `SESSIONS` | KV | session tokens (+ rate-limit counters) |

> `database_id` / KV `id` are local placeholders. Before deploying, run
> `wrangler d1 create organizard` + `wrangler kv namespace create SESSIONS` and
> paste the real ids in.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/v1/auth/apple` · `/v1/auth/email/register` · `/v1/auth/email/login` | sign in |
| POST · DELETE | `/v1/auth/logout` · `/v1/auth/logout-all` · `DELETE /v1/auth/account` | sign out (one / all sessions) · delete account |
| GET | `/v1/me` | user + their moves |
| POST | `/v1/moves` | create shared move (entitlement-gated while billing is on) |
| GET · DELETE | `/v1/moves/:id` · `/v1/moves/:id/changes?since=` | snapshot · delta · owner deletes the move |
| POST | `/v1/moves/:id/mutations` | batch apply (role-checked, idempotent, arrival-order conflicts) |
| POST | `/v1/moves/:id/invites` · `POST /v1/invites/:token/accept` | sharing |
| PATCH·DELETE | `/v1/moves/:id/members/:userId` | owner only |
| POST | `/v1/moves/:id/photos` · `PUT·GET /v1/photos/:id` | R2 photos |
| POST | `/v1/webhooks/revenuecat` | entitlement sync |
| GET | `/privacy` · `/support` | public pages for the App Store listing |

## Deploy

```bash
wrangler d1 create organizard          # paste database_id into wrangler.toml
wrangler kv namespace create SESSIONS  # paste id into wrangler.toml
wrangler r2 bucket create organizard-photos
wrangler d1 migrations apply organizard --remote
wrangler secret put APPLE_BUNDLE_ID
wrangler secret put REVENUECAT_WEBHOOK_SECRET
wrangler deploy
```

## Status

Auth (Apple + email/password), the mutation/sync engine, sharing, photos, account
deletion and the public legal pages are live in production. Billing (RevenueCat) is
wired but switched off; everything is free for now.
