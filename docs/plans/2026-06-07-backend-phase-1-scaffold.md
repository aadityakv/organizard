# Backend Phase 1 — Scaffold Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up the Cloudflare Worker backend skeleton — `/server` (Hono + Drizzle on D1/R2/KV) and `/shared` (types) — with a tested `GET /v1/health` route, the full D1 schema, and a generated first migration, all runnable under `wrangler dev` and `vitest`.

**Architecture:** A single Hono Worker is the API. Drizzle ORM defines the D1 schema and generates SQL migrations. A `/shared` folder holds domain + mutation types imported by the server (and later the client) to prevent drift. Phase 1 only proves the skeleton boots and is tested; auth/data/sync land in later phases.

**Tech Stack:** Cloudflare Workers, Hono 4, Drizzle ORM + drizzle-kit, D1 (SQLite), R2, KV, Vitest + `@cloudflare/vitest-pool-workers`, TypeScript.

**Worktree:** `/Users/aaditya/Projects/organizard/.worktrees/organizard-backend` (branch `organizard-backend`). All paths below are relative to it.

---

### Task 1: `/shared` domain + mutation types

**Files:**
- Create: `shared/models.ts`, `shared/mutations.ts`, `shared/index.ts`

**Step 1:** Write `shared/models.ts` — `Role`, and the move subtree shapes (`Move`, `Room`, `Status`, `Marker`, `Box`, `Item`, `Member`), money as `valueCents: number`, every mutable shape carrying `updatedAt: number` and `deletedAt?: number | null`.

**Step 2:** Write `shared/mutations.ts` — the discriminated union `Mutation` (`addRoom | updateRoom | deleteRoom | addBox | updateBox | deleteBox | setBoxStatus | setBoxCover | toggleBoxMarker | addStatus | addMarker | addItem | updateItem | deleteItem`), each `{ type, clientId, ts, payload }`, plus `ROLE_REQUIRED: Record<Mutation['type'], 'canEdit' | 'owner'>`.

**Step 3:** Write `shared/index.ts` re-exporting both.

**Step 4: Commit**
```bash
git add shared && git commit -m "feat(shared): domain + mutation types"
```

---

### Task 2: `/server` package + tooling

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/wrangler.toml`, `server/.gitignore`, `server/src/types.ts`

**Step 1:** `server/package.json` — deps `hono`, `drizzle-orm`; devDeps `wrangler`, `drizzle-kit`, `vitest@~2.0`, `@cloudflare/vitest-pool-workers`, `@cloudflare/workers-types`, `typescript`. Scripts: `dev` (`wrangler dev`), `test` (`vitest run`), `typecheck` (`tsc --noEmit`), `db:generate` (`drizzle-kit generate`), `db:migrate:local` (`wrangler d1 migrations apply organizard --local`).

**Step 2:** `server/wrangler.toml` — `name`, `main = "src/index.ts"`, recent `compatibility_date`, `nodejs_compat`, and bindings: D1 `DB` (database_name `organizard`, placeholder id ok for local), R2 `PHOTOS`, KV `SESSIONS`, `[[migrations]]` dir.

**Step 3:** `server/tsconfig.json` — strict, `types: ["@cloudflare/workers-types"]`, path `@shared/*` → `../shared/*`.

**Step 4:** `server/src/types.ts` — `export type Env = { DB: D1Database; PHOTOS: R2Bucket; SESSIONS: KVNamespace }`.

**Step 5:** `cd server && npm install`.

**Step 6: Commit**
```bash
git add server && git commit -m "chore(server): scaffold worker package + wrangler config"
```

---

### Task 3: Drizzle D1 schema + first migration

**Files:**
- Create: `server/src/db/schema.ts`, `server/drizzle.config.ts`
- Generate: `server/drizzle/0000_*.sql`

**Step 1:** `server/src/db/schema.ts` — Drizzle `sqliteTable` for every table in §5 of the design doc (`users, moves, members, rooms, statuses, markers, boxes, items, boxMarkers, itemMarkers, photos, invites`), text ids, integer `updatedAt`/`deletedAt`, `valueCents` integer, FKs + the `members` unique(move_id,user_id) index. Export inferred `$inferSelect` types.

**Step 2:** `server/drizzle.config.ts` — dialect `sqlite`, driver `d1-http` (schema-only generate), `schema: './src/db/schema.ts'`, `out: './drizzle'`.

**Step 3:** Generate migration.
Run: `cd server && npm run db:generate`
Expected: `drizzle/0000_*.sql` created with all `CREATE TABLE` statements.

**Step 4:** Apply locally to confirm it's valid SQL.
Run: `cd server && npm run db:migrate:local`
Expected: applies cleanly to the local D1 sqlite.

**Step 5: Commit**
```bash
git add server/src/db server/drizzle server/drizzle.config.ts && git commit -m "feat(server): D1 schema + first migration"
```

---

### Task 4 (TDD): `GET /v1/health`

**Files:**
- Create: `server/src/index.ts`, `server/vitest.config.ts`, `server/test/health.test.ts`

**Step 1: Write the failing test** — `server/test/health.test.ts`
```ts
import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('GET /v1/health', () => {
  it('returns ok with a timestamp', async () => {
    const res = await SELF.fetch('https://example.com/v1/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true });
    expect(typeof (body as any).time).toBe('number');
  });
});
```

**Step 2:** `server/vitest.config.ts` — `defineWorkersConfig` from `@cloudflare/vitest-pool-workers/config`, pointing `wrangler.configPath` at `./wrangler.toml`.

**Step 3: Run test to verify it fails**
Run: `cd server && npm test`
Expected: FAIL (no `src/index.ts` export / 404).

**Step 4: Write minimal implementation** — `server/src/index.ts`
```ts
import { Hono } from 'hono';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

app.get('/v1/health', (c) => c.json({ ok: true, time: Date.now() }));

export default app;
```

**Step 5: Run test to verify it passes**
Run: `cd server && npm test`
Expected: PASS (1 test).

**Step 6:** Boot it for real.
Run (background): `cd server && npx wrangler dev --port 8787`
Then: `curl -s localhost:8787/v1/health`
Expected: `{"ok":true,"time":...}`. Stop the dev server.

**Step 7: Commit**
```bash
git add server/src/index.ts server/vitest.config.ts server/test && git commit -m "feat(server): GET /v1/health (tested)"
```

---

### Task 5: Server typecheck gate + README

**Files:**
- Create: `server/README.md`

**Step 1:** Run `cd server && npm run typecheck` → expect 0 errors.
**Step 2:** Write `server/README.md` — how to `npm run dev` / `test` / `db:generate`, the bindings, and the link to the design doc.
**Step 3: Commit**
```bash
git add server/README.md && git commit -m "docs(server): phase-1 readme"
```

---

## Done when
- `cd server && npm test` → green (health test).
- `cd server && npm run typecheck` → 0 errors.
- `wrangler dev` serves `/v1/health`.
- `drizzle/0000_*.sql` exists with all tables and applies to local D1.

## Next (planned as we reach them — see design doc §14)
Phase 2 auth · Phase 3 mutation engine · Phase 4 client sync · Phase 5 sharing · Phase 6 photos/R2 · Phase 7 billing · Phase 8 hardening.
