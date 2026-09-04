// Composition root for the Worker. createApp() wires middleware and routers with a
// Deps object (db, clock, ids, Apple verify, email) that tests override, so the full
// HTTP surface runs in-process without Miniflare.
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

import { defaultDeps, type Deps } from './deps';
import { authMiddleware, type AuthVars } from './middleware/auth';
import { requestLogMiddleware } from './middleware/requestLog';
import { getUserMoves } from './repos/moves';
import { toPublicUser } from './repos/users';
import { authRoutes } from './routes/auth';
import { inviteRoutes } from './routes/invites';
import { legalRoutes } from './routes/legal';
import { moveRoutes } from './routes/moves';
import { photoBlobRoutes } from './routes/photos';
import { webhookRoutes } from './routes/webhooks';
import type { Env } from './types';

/** Build the Worker app; `overrides` swap in test doubles for the injectable deps. */
export function createApp(overrides: Partial<Deps> = {}) {
  const deps: Deps = { ...defaultDeps, ...overrides };
  const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

  app.use('*', secureHeaders());
  app.notFound((c) => c.json({ error: 'NOT_FOUND' }, 404));
  app.onError((err, c) => {
    console.error('unhandled', err);
    return c.json({ error: 'INTERNAL' }, 500);
  });

  // Registered first so it wraps every route (incl. legal pages and 404s).
  app.use('*', requestLogMiddleware());

  app.get('/v1/health', (c) => c.json({ ok: true, time: deps.now() }));

  // Public legal/support pages (App Store requires a privacy + support URL).
  app.route('/', legalRoutes());

  app.route('/v1/auth', authRoutes(deps));
  app.route('/v1/moves', moveRoutes(deps));
  app.route('/v1/invites', inviteRoutes(deps));
  app.route('/v1/photos', photoBlobRoutes(deps));
  app.route('/v1/webhooks', webhookRoutes(deps));

  app.get('/v1/me', authMiddleware(deps), async (c) => {
    const moves = await getUserMoves(deps.getDb(c.env), c.get('user').id);
    return c.json({ user: toPublicUser(c.get('user')), moves });
  });

  return app;
}
