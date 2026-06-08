import { Hono } from 'hono';

import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// Liveness probe. Phase 1 skeleton — auth/data/sync routes land in later phases.
app.get('/v1/health', (c) => c.json({ ok: true, time: Date.now() }));

export default app;
