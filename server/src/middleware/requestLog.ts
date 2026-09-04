import { createMiddleware } from 'hono/factory';

import type { Deps } from '../deps';
import type { Env } from '../types';
import type { AuthVars } from './auth';

/**
 * One structured JSON line per request → Workers Logs (`[observability]` in
 * wrangler.toml). Logs method/path/status/duration/userId only — never bodies
 * or query strings (invite codes and tokens can appear there), and invite
 * tokens embedded in the path are redacted. Thrown errors are logged with
 * their stack before being rethrown, so Hono's default error handler still
 * produces the 500 response.
 *
 * `user` is read AFTER `next()` resolves (auth middleware sets it on the way
 * in), so it is populated for authed routes and undefined for public ones.
 */
const REDACT_INVITE = /^(\/v1\/invites\/)[^/]+/;

export function requestLogMiddleware(deps: Deps) {
  return createMiddleware<{ Bindings: Env; Variables: AuthVars }>(async (c, next) => {
    const start = Date.now();
    const path = c.req.path.replace(REDACT_INVITE, '$1[redacted]');
    try {
      await next();
    } catch (e) {
      deps.log(
        'error',
        JSON.stringify({
          evt: 'http',
          method: c.req.method,
          path,
          status: 500,
          ms: Date.now() - start,
          userId: c.get('user')?.id,
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack?.split('\n').slice(0, 6).join(' | ') : undefined,
        }),
      );
      throw e;
    }
    deps.log(
      'info',
      JSON.stringify({
        evt: 'http',
        method: c.req.method,
        path,
        status: c.res.status,
        ms: Date.now() - start,
        userId: c.get('user')?.id,
      }),
    );
  });
}
