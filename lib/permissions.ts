// Permission model — the differentiator.
// Owner / Editor / Viewer. Affordances appear & disappear by role.
import type { Role } from '@/data/types';
import { ROLES } from '@/shared';

export const PERM = {
  /** Add / edit / delete boxes & items. */
  canEdit: (role: Role) => role === ROLES.owner || role === ROLES.editor,
  /** Manage members & roles. */
  canManage: (role: Role) => role === ROLES.owner,
  /** Delete a box / the move. */
  canDelete: (role: Role) => role === ROLES.owner,
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
};

/** Plain-language description — never show role jargon alone. */
export const ROLE_BLURB: Record<Role, string> = {
  owner: 'Full control — manages members & roles',
  editor: 'Can add & edit everything',
  viewer: 'Can view and scan only',
};

/** Lucide icon per role (shield / pencil / eye). */
export const ROLE_ICON: Record<Role, string> = {
  owner: 'shield',
  editor: 'pencil',
  viewer: 'eye',
};
