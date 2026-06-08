// Typed client for the Organizard backend. All calls go through `req`, which
// attaches the Bearer session and turns non-2xx into a typed ApiError.
import type { Box, Item, Marker, Member, Move, Mutation, Role, Room, Status } from '@/shared';
import { API_URL } from './config';

export type PublicUser = {
  id: string;
  name: string;
  email: string | null;
  avatarColor: string;
  entitlementActive: boolean;
};
export type AuthResult = { session: string; user: PublicUser };
export type MeResult = { user: PublicUser; moves: (Move & { role: Role })[] };

export type ServerSnapshot = {
  move: Move;
  members: Member[];
  rooms: Room[];
  statuses: Status[];
  markers: Marker[];
  boxes: Box[];
  items: Item[];
};
export type ServerChanges = {
  serverTime: number;
  cursor: number;
  hasMore: boolean;
  rooms: Room[];
  statuses: Status[];
  markers: Marker[];
  boxes: Box[];
  items: Item[];
  members: Member[];
};
export type InviteResult = { token: string; role: Role; expiresAt: number; url: string };

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(`${status} ${code}`);
    this.name = 'ApiError';
  }
}

async function req<T>(path: string, init: RequestInit, session: string | null): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let code = 'ERROR';
    try {
      code = ((await res.json()) as { error?: string }).error ?? code;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  // --- auth ---
  appleLogin: (identityToken: string) =>
    req<AuthResult>('/v1/auth/apple', { method: 'POST', body: JSON.stringify({ identityToken }) }, null),
  emailStart: (email: string) =>
    req<{ ok: true }>('/v1/auth/email/start', { method: 'POST', body: JSON.stringify({ email }) }, null),
  emailVerify: (token: string) =>
    req<AuthResult>(`/v1/auth/email/verify?token=${encodeURIComponent(token)}`, { method: 'GET' }, null),
  me: (session: string) => req<MeResult>('/v1/me', { method: 'GET' }, session),
  logout: (session: string) => req<{ ok: true }>('/v1/auth/logout', { method: 'POST' }, session),

  // --- moves / sync ---
  createMove: (session: string, body: { name: string; from?: string | null; to?: string | null; targetDate?: string | null; seed?: boolean }) =>
    req<ServerSnapshot>('/v1/moves', { method: 'POST', body: JSON.stringify(body) }, session),
  snapshot: (session: string, moveId: string) => req<ServerSnapshot>(`/v1/moves/${moveId}`, { method: 'GET' }, session),
  changes: (session: string, moveId: string, since: number) =>
    req<ServerChanges>(`/v1/moves/${moveId}/changes?since=${since}`, { method: 'GET' }, session),
  mutations: (session: string, moveId: string, mutations: Mutation[]) =>
    req<{ serverTime: number; applied: number }>(`/v1/moves/${moveId}/mutations`, { method: 'POST', body: JSON.stringify({ mutations }) }, session),

  // --- sharing ---
  createInvite: (session: string, moveId: string, role: Role) =>
    req<InviteResult>(`/v1/moves/${moveId}/invites`, { method: 'POST', body: JSON.stringify({ role }) }, session),
  acceptInvite: (session: string, token: string) =>
    req<ServerSnapshot>(`/v1/invites/${token}/accept`, { method: 'POST', body: '{}' }, session),
  changeRole: (session: string, moveId: string, userId: string, role: Role) =>
    req<{ ok: true }>(`/v1/moves/${moveId}/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }, session),
  removeMember: (session: string, moveId: string, userId: string) =>
    req<{ ok: true }>(`/v1/moves/${moveId}/members/${userId}`, { method: 'DELETE' }, session),

  // --- photos ---
  createPhoto: (session: string, moveId: string, link: { itemId?: string; boxId?: string }) =>
    req<{ photoId: string; uploadPath: string }>(`/v1/moves/${moveId}/photos`, { method: 'POST', body: JSON.stringify(link) }, session),
};
