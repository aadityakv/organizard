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

## Status

**Phase 1 (scaffold):** `GET /v1/health`, full D1 schema + first migration.
Next: Phase 2 auth (Apple + email magic link). See the design doc §14 for the roadmap.
