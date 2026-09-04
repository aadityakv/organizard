// Runtime validation for every request body. The mutation batch is the main
// untrusted surface: a discriminated union mirroring shared/mutations.ts rejects
// unknown types, missing fields and out-of-range numbers before anything is applied.
import { ROLES } from '@shared/index';
import { z } from 'zod';

// Every untrusted string is length-capped so one request can't push megabytes
// into D1 (and from there into every snapshot/delta). Ids are ~21 chars, names
// and labels are short; notes/dest get the generous cap.
const str = z.string().min(1).max(200);
const nstr = z.string().max(4000).nullable();
// Apple identity tokens are signed JWTs — much longer than a normal field.
const tokenStr = z.string().min(1).max(8192);
const ids = z.array(str).max(50);

const mutationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('addRoom'),
    clientId: str,
    ts: z.number(),
    payload: z.object({ id: str, name: str, dest: nstr.optional(), icon: str, color: str.optional() }),
  }),
  z.object({
    type: z.literal('updateRoom'),
    clientId: str,
    ts: z.number(),
    payload: z.object({
      id: str,
      name: str.optional(),
      dest: nstr.optional(),
      icon: str.optional(),
      color: str.optional(),
    }),
  }),
  z.object({ type: z.literal('deleteRoom'), clientId: str, ts: z.number(), payload: z.object({ id: str }) }),
  z.object({
    type: z.literal('addBox'),
    clientId: str,
    ts: z.number(),
    payload: z.object({
      id: str,
      roomId: str,
      number: z.number().int().nonnegative().max(1_000_000),
      name: str,
      color: str,
      statusId: str,
    }),
  }),
  z.object({
    type: z.literal('updateBox'),
    clientId: str,
    ts: z.number(),
    payload: z.object({ id: str, name: str.optional(), color: str.optional(), roomId: str.optional() }),
  }),
  z.object({ type: z.literal('deleteBox'), clientId: str, ts: z.number(), payload: z.object({ id: str }) }),
  z.object({
    type: z.literal('setBoxStatus'),
    clientId: str,
    ts: z.number(),
    payload: z.object({ id: str, statusId: str }),
  }),
  z.object({
    type: z.literal('setBoxCover'),
    clientId: str,
    ts: z.number(),
    payload: z.object({ id: str, coverPhotoId: z.string().nullable() }),
  }),
  z.object({
    type: z.literal('setBoxMarker'),
    clientId: str,
    ts: z.number(),
    payload: z.object({ boxId: str, markerId: str, on: z.boolean() }),
  }),
  z.object({
    type: z.literal('addStatus'),
    clientId: str,
    ts: z.number(),
    payload: z.object({ id: str, label: str, color: str }),
  }),
  z.object({
    type: z.literal('addMarker'),
    clientId: str,
    ts: z.number(),
    payload: z.object({ id: str, label: str, color: str, icon: str }),
  }),
  z.object({
    type: z.literal('addItem'),
    clientId: str,
    ts: z.number(),
    payload: z.object({
      id: str,
      boxId: str,
      name: str,
      qty: z.number().int().min(1).max(1_000_000),
      valueCents: z.number().int().min(0).max(1_000_000_000),
      note: nstr.optional(),
      icon: nstr.optional(),
      markerIds: ids.optional(),
      photoIds: ids.optional(),
    }),
  }),
  z.object({
    type: z.literal('updateItem'),
    clientId: str,
    ts: z.number(),
    payload: z.object({
      id: str,
      boxId: str,
      name: str.optional(),
      qty: z.number().int().min(1).max(1_000_000).optional(),
      valueCents: z.number().int().min(0).max(1_000_000_000).optional(),
      note: nstr.optional(),
      markerIds: ids.optional(),
      photoIds: ids.optional(),
    }),
  }),
  z.object({
    type: z.literal('deleteItem'),
    clientId: str,
    ts: z.number(),
    payload: z.object({ id: str, boxId: str }),
  }),
  z.object({
    type: z.literal('moveItem'),
    clientId: str,
    ts: z.number(),
    payload: z.object({ id: str, fromBoxId: str, toBoxId: str }),
  }),
  // updateMove: all fields optional. Allow empty strings so the user can clear a field (e.g. unset the target date).
  z.object({
    type: z.literal('updateMove'),
    clientId: str,
    ts: z.number(),
    payload: z.object({
      // 120 to match createMoveBody — a name legal at update must stay legal at share-time.
      name: z.string().min(1).max(120).optional(),
      from: z.string().max(200).optional(),
      to: z.string().max(200).optional(),
      target: z.string().max(200).optional(),
    }),
  }),
]);

/** Validate a mutations request body. Caps batch size to bound work. */
export const mutationsBodySchema = z.object({ mutations: z.array(mutationSchema).max(500) });

// ---- request bodies ----

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200;

const email = z.string().trim().toLowerCase().max(254).regex(EMAIL_RE);

export const appleLoginBody = z.object({ identityToken: tokenStr });
export const registerBody = z.object({ email, password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX) });
export const loginBody = z.object({ email, password: str });
export const createMoveBody = z.object({
  name: z.string().trim().min(1).max(120),
  from: nstr.optional(),
  to: nstr.optional(),
  targetDate: nstr.optional(),
  seed: z.boolean().optional(),
  /** Stable id (the local move's id) so a retried share reuses the server move. */
  clientId: str.optional(),
});
/** Invites can only grant editor/viewer — ownership is never transferable via invite. */
export const inviteBody = z.object({ role: z.enum([ROLES.editor, ROLES.viewer]).default(ROLES.viewer) });
/** Only editor/viewer are assignable; ownership transfer is not a role change. */
export const memberRoleBody = z.object({ role: z.enum([ROLES.editor, ROLES.viewer]) });
/** A photo must link to an item or a box — otherwise it is unreachable and orphaned forever. */
export const photoLinkBody = z
  .object({ itemId: str.optional(), boxId: str.optional() })
  .refine((d) => Boolean(d.itemId || d.boxId), { message: 'itemId or boxId required' });
export const webhookBody = z.object({
  event: z.object({ type: str, app_user_id: str, expiration_at_ms: z.number().nullish() }),
});

export type ParsedBody<T> = { ok: true; data: T } | { ok: false; field: string | null };

/**
 * Read and validate a JSON body. A missing or malformed body fails like an invalid
 * one; `field` names the first offending top-level key so a route can pick its code.
 */
export async function parseBody<S extends z.ZodTypeAny>(
  c: { req: { json: () => Promise<unknown> } },
  schema: S,
): Promise<ParsedBody<z.infer<S>>> {
  const raw = await c.req.json().catch(() => undefined);
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  const path = result.error.issues[0]?.path[0];
  return { ok: false, field: typeof path === 'string' ? path : null };
}
