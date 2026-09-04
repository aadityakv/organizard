// Drizzle schema for D1 (SQLite).
// Conventions: text UUID ids (client may mint them), integer ms timestamps,
// `updated_at` + nullable `deleted_at` tombstones on synced rows, money as cents.
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { ROLE_LIST } from '@shared/index';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  appleSub: text('apple_sub').unique(),
  email: text('email').unique(),
  // Set only for email/password accounts; null for Sign-in-with-Apple users.
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  avatarColor: text('avatar_color').notNull().default('green'),
  entitlementActive: integer('entitlement_active', { mode: 'boolean' }).notNull().default(false),
  entitlementExpiresAt: integer('entitlement_expires_at'),
  createdAt: integer('created_at').notNull(),
});

export const moves = sqliteTable(
  'moves',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    fromAddr: text('from_addr'),
    toAddr: text('to_addr'),
    targetDate: text('target_date'),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id),
    /** The creating client's local move id — makes share/create idempotent per owner. */
    clientId: text('client_id'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({ ownerClient: uniqueIndex('moves_owner_client').on(t.ownerId, t.clientId) }),
);

/** Move membership with role; one row per (move, user). */
export const members = sqliteTable(
  'members',
  {
    id: text('id').primaryKey(),
    moveId: text('move_id')
      .notNull()
      .references(() => moves.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role', { enum: ROLE_LIST }).notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({ moveUser: uniqueIndex('members_move_user').on(t.moveId, t.userId) }),
);

export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  moveId: text('move_id')
    .notNull()
    .references(() => moves.id),
  name: text('name').notNull(),
  dest: text('dest'),
  icon: text('icon').notNull().default('box'),
  color: text('color').notNull().default('slate'),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

export const statuses = sqliteTable('statuses', {
  id: text('id').primaryKey(),
  moveId: text('move_id')
    .notNull()
    .references(() => moves.id),
  label: text('label').notNull(),
  color: text('color').notNull(),
  custom: integer('custom', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

export const markers = sqliteTable('markers', {
  id: text('id').primaryKey(),
  moveId: text('move_id')
    .notNull()
    .references(() => moves.id),
  label: text('label').notNull(),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  custom: integer('custom', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

export const boxes = sqliteTable('boxes', {
  id: text('id').primaryKey(),
  moveId: text('move_id')
    .notNull()
    .references(() => moves.id),
  roomId: text('room_id')
    .notNull()
    .references(() => rooms.id),
  number: integer('number').notNull(),
  name: text('name').notNull(),
  color: text('color').notNull().default('green'),
  statusId: text('status_id').notNull(),
  coverPhotoId: text('cover_photo_id'),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  moveId: text('move_id')
    .notNull()
    .references(() => moves.id),
  boxId: text('box_id')
    .notNull()
    .references(() => boxes.id),
  name: text('name').notNull(),
  qty: integer('qty').notNull().default(1),
  valueCents: integer('value_cents').notNull().default(0),
  note: text('note'),
  icon: text('icon'),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

/** Join table: markers applied to a box. */
export const boxMarkers = sqliteTable(
  'box_markers',
  {
    boxId: text('box_id')
      .notNull()
      .references(() => boxes.id),
    markerId: text('marker_id')
      .notNull()
      .references(() => markers.id),
  },
  (t) => ({ pk: primaryKey({ columns: [t.boxId, t.markerId] }) }),
);

/** Join table: markers applied to an item. */
export const itemMarkers = sqliteTable(
  'item_markers',
  {
    itemId: text('item_id')
      .notNull()
      .references(() => items.id),
    markerId: text('marker_id')
      .notNull()
      .references(() => markers.id),
  },
  (t) => ({ pk: primaryKey({ columns: [t.itemId, t.markerId] }) }),
);

export const photos = sqliteTable('photos', {
  id: text('id').primaryKey(),
  moveId: text('move_id')
    .notNull()
    .references(() => moves.id),
  itemId: text('item_id'),
  boxId: text('box_id'),
  r2Key: text('r2_key').notNull(),
  /** Set when the bytes landed in R2; a photo is only surfaced to clients after this. */
  uploadedAt: integer('uploaded_at'),
  width: integer('width'),
  height: integer('height'),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: integer('created_at').notNull(),
});

export const invites = sqliteTable('invites', {
  id: text('id').primaryKey(),
  moveId: text('move_id')
    .notNull()
    .references(() => moves.id),
  role: text('role', { enum: ROLE_LIST }).notNull(),
  token: text('token').notNull().unique(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  expiresAt: integer('expires_at').notNull(),
  acceptedBy: text('accepted_by'),
});

// Idempotency: a processed mutation's clientId is recorded so retries are no-ops.
export const mutationLog = sqliteTable(
  'mutation_log',
  {
    moveId: text('move_id')
      .notNull()
      .references(() => moves.id),
    clientId: text('client_id').notNull(),
    appliedAt: integer('applied_at').notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.moveId, t.clientId] }) }),
);
