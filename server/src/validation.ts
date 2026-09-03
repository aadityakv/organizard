// Runtime validation for the mutation batch (the main untrusted surface).
// A discriminated union mirroring shared/mutations.ts — rejects unknown types,
// missing fields, and out-of-range numbers before anything is applied.
import { z } from 'zod';

const str = z.string().min(1);
const nstr = z.string().nullable();

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
      number: z.number().int().nonnegative(),
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
      qty: z.number().int().min(1),
      valueCents: z.number().int().min(0),
      note: nstr.optional(),
      icon: nstr.optional(),
      markerIds: z.array(str).optional(),
      photoIds: z.array(str).optional(),
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
      qty: z.number().int().min(1).optional(),
      valueCents: z.number().int().min(0).optional(),
      note: nstr.optional(),
      markerIds: z.array(str).optional(),
      photoIds: z.array(str).optional(),
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
      name: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      target: z.string().optional(),
    }),
  }),
]);

/** Validate a mutations request body. Caps batch size to bound work. */
export const mutationsBodySchema = z.object({ mutations: z.array(mutationSchema).max(500) });
