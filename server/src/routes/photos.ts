// /v1/photos/:photoId: PUT uploads bytes to R2 and GET streams them back, both scoped
// to the caller's membership in the photo's move.
import { Hono } from 'hono';

import type { Deps } from '../deps';
import { billingEnabled } from '../lib/flags';
import { authMiddleware, type AuthVars } from '../middleware/auth';
import { getMembership } from '../repos/moves';
import { getPhoto } from '../repos/photos';
import { isOwnerEntitled } from '../repos/sharing';
import type { Env } from '../types';

// Blob upload/download for photos. Membership is checked via the photo's move
// (these routes aren't under /moves/:id, so membershipMiddleware doesn't apply).
export function photoBlobRoutes(deps: Deps) {
  const r = new Hono<{ Bindings: Env; Variables: AuthVars }>();
  r.use('*', authMiddleware(deps));

  r.put('/:photoId', async (c) => {
    const db = deps.getDb(c.env);
    const photo = await getPhoto(db, c.req.param('photoId'));
    if (!photo) return c.json({ error: 'NOT_FOUND' }, 404);
    const member = await getMembership(db, photo.moveId, c.get('user').id);
    if (!member) return c.json({ error: 'NOT_FOUND' }, 404);
    if (member.role === 'viewer') return c.json({ error: 'FORBIDDEN_ROLE' }, 403);
    if (billingEnabled(c.env) && !(await isOwnerEntitled(db, photo.moveId, deps.now())))
      return c.json({ error: 'ENTITLEMENT_REQUIRED' }, 402);

    const body = await c.req.arrayBuffer();
    await c.env.PHOTOS.put(photo.r2Key, body, {
      httpMetadata: { contentType: c.req.header('content-type') ?? 'image/jpeg' },
    });
    return c.json({ ok: true });
  });

  // Stream a photo back (membership-checked) — clients fetch with the Bearer header.
  r.get('/:photoId', async (c) => {
    const db = deps.getDb(c.env);
    const photo = await getPhoto(db, c.req.param('photoId'));
    if (!photo) return c.json({ error: 'NOT_FOUND' }, 404);
    const member = await getMembership(db, photo.moveId, c.get('user').id);
    if (!member) return c.json({ error: 'NOT_FOUND' }, 404);

    const obj = await c.env.PHOTOS.get(photo.r2Key);
    if (!obj) return c.json({ error: 'NOT_FOUND' }, 404);
    const buf = await obj.arrayBuffer();
    return new Response(buf, {
      headers: {
        'content-type': obj.httpMetadata?.contentType ?? 'image/jpeg',
        'cache-control': 'private, max-age=86400',
      },
    });
  });

  return r;
}
