// /v1/photos/:photoId: PUT uploads bytes to R2 and GET streams them back, both scoped
// to the caller's membership in the photo's move.
import { Hono } from 'hono';

import type { Deps } from '../deps';
import { ownerEntitledOrResponse } from '../lib/flags';
import { authMiddleware, type AuthVars } from '../middleware/auth';
import { getMembership } from '../repos/moves';
import { getPhoto, markPhotoUploaded } from '../repos/photos';
import type { Env } from '../types';
import { ROLES } from '@shared/index';

// Blob upload/download for photos. Membership is checked via the photo's move
// (these routes aren't under /moves/:id, so membershipMiddleware doesn't apply).
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

export function photoBlobRoutes(deps: Deps) {
  const r = new Hono<{ Bindings: Env; Variables: AuthVars }>();
  r.use('*', authMiddleware(deps));

  r.put('/:photoId', async (c) => {
    const db = deps.getDb(c.env);
    const photo = await getPhoto(db, c.req.param('photoId'));
    if (!photo) return c.json({ error: 'NOT_FOUND' }, 404);
    const member = await getMembership(db, photo.moveId, c.get('user').id);
    if (!member) return c.json({ error: 'NOT_FOUND' }, 404);
    if (member.role === ROLES.viewer) return c.json({ error: 'FORBIDDEN_ROLE' }, 403);
    const entitled = await ownerEntitledOrResponse(deps, c, photo.moveId);
    if (entitled) return entitled;

    const declared = Number(c.req.header('content-length') ?? '0');
    if (declared > MAX_PHOTO_BYTES) return c.json({ error: 'TOO_LARGE' }, 413);
    const body = await c.req.arrayBuffer();
    if (body.byteLength > MAX_PHOTO_BYTES) return c.json({ error: 'TOO_LARGE' }, 413);
    await c.env.PHOTOS.put(photo.r2Key, body, {
      httpMetadata: { contentType: c.req.header('content-type') ?? 'image/jpeg' },
    });
    await markPhotoUploaded(db, photo, deps.now());
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
    return new Response(obj.body, {
      headers: {
        'content-type': obj.httpMetadata?.contentType ?? 'image/jpeg',
        'cache-control': 'private, max-age=86400',
      },
    });
  });

  return r;
}
