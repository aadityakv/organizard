import { Hono } from 'hono';

import { defaultDeps, type Deps } from './deps';
import { authMiddleware, type AuthVars } from './middleware/auth';
import { getUserMoves } from './repos/moves';
import { toPublicUser } from './repos/users';
import { authRoutes } from './routes/auth';
import { inviteRoutes } from './routes/invites';
import { moveRoutes } from './routes/moves';
import { photoBlobRoutes } from './routes/photos';
import type { Env } from './types';

/**
 * Build the Worker app. `overrides` swaps in test doubles for db / time / ids /
 * Apple verify / email — production uses `defaultDeps`.
 */
export function createApp(overrides: Partial<Deps> = {}) {
  const deps: Deps = { ...defaultDeps, ...overrides };
  const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

  app.get('/v1/health', (c) => c.json({ ok: true, time: deps.now() }));

  app.route('/v1/auth', authRoutes(deps));
  app.route('/v1/moves', moveRoutes(deps));
  app.route('/v1/invites', inviteRoutes(deps));
  app.route('/v1/photos', photoBlobRoutes(deps));

  app.get('/v1/me', authMiddleware(deps), async (c) => {
    const moves = await getUserMoves(deps.getDb(c.env), c.get('user').id);
    return c.json({ user: toPublicUser(c.get('user')), moves });
  });

  return app;
}
