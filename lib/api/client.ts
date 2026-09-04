// Typed client for the Tuck API, built by createApi(baseUrl, fetch, timeout) so tests
// can drive it with a fake fetch. Every call goes through `req`, which attaches the
// Bearer session, aborts after the timeout, and turns non-2xx into a typed ApiError.
import type { Box, Item, Marker, Member, Move, Mutation, Role, Room, Status } from '@/shared';

type PublicUser = {
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
  /** The move row itself when it changed since the cursor (rename/address/date); else null. */
  move: Move | null;
  rooms: Room[];
  statuses: Status[];
  markers: Marker[];
  boxes: Box[];
  items: Item[];
  members: Member[];
};
export type InviteResult = { token: string; role: Role; expiresAt: number; url: string };

/** Non-2xx response from the API, carrying the HTTP status and the server's error code. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(`${status} ${code}`);
    this.name = 'ApiError';
  }
}

/** Requests that hang would hold the sync mutex forever; abort them instead. */
const REQUEST_TIMEOUT_MS = 30_000; // mutation batches after a long offline stretch can be large

export function createApi(baseUrl: string, fetchImpl: typeof fetch = fetch, timeoutMs = REQUEST_TIMEOUT_MS) {
  async function req<T>(path: string, init: RequestInit, session: string | null): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
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
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    appleLogin: (identityToken: string) =>
      req<AuthResult>('/v1/auth/apple', { method: 'POST', body: JSON.stringify({ identityToken }) }, null),
    emailRegister: (email: string, password: string) =>
      req<AuthResult>(
        '/v1/auth/email/register',
        { method: 'POST', body: JSON.stringify({ email, password }) },
        null,
      ),
    emailLogin: (email: string, password: string) =>
      req<AuthResult>(
        '/v1/auth/email/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
        null,
      ),
    me: (session: string) => req<MeResult>('/v1/me', { method: 'GET' }, session),
    logout: (session: string) => req<{ ok: true }>('/v1/auth/logout', { method: 'POST' }, session),
    deleteAccount: (session: string) => req<{ ok: true }>('/v1/auth/account', { method: 'DELETE' }, session),

    createMove: (
      session: string,
      body: {
        name: string;
        from?: string | null;
        to?: string | null;
        targetDate?: string | null;
        seed?: boolean;
        /** The local move's id — a retried share reuses the existing server move. */
        clientId?: string;
      },
    ) => req<ServerSnapshot>('/v1/moves', { method: 'POST', body: JSON.stringify(body) }, session),
    snapshot: (session: string, moveId: string) =>
      req<ServerSnapshot>(`/v1/moves/${moveId}`, { method: 'GET' }, session),
    changes: (session: string, moveId: string, since: number) =>
      req<ServerChanges>(`/v1/moves/${moveId}/changes?since=${since}`, { method: 'GET' }, session),
    mutations: (session: string, moveId: string, mutations: Mutation[]) =>
      req<{ serverTime: number; applied: number }>(
        `/v1/moves/${moveId}/mutations`,
        { method: 'POST', body: JSON.stringify({ mutations }) },
        session,
      ),
    deleteMove: (session: string, moveId: string) =>
      req<{ ok: true }>(`/v1/moves/${moveId}`, { method: 'DELETE' }, session),

    createInvite: (session: string, moveId: string, role: Role) =>
      req<InviteResult>(
        `/v1/moves/${moveId}/invites`,
        { method: 'POST', body: JSON.stringify({ role }) },
        session,
      ),
    acceptInvite: (session: string, token: string) =>
      req<ServerSnapshot>(`/v1/invites/${token}/accept`, { method: 'POST', body: '{}' }, session),
    changeRole: (session: string, moveId: string, userId: string, role: Role) =>
      req<{ ok: true }>(
        `/v1/moves/${moveId}/members/${userId}`,
        { method: 'PATCH', body: JSON.stringify({ role }) },
        session,
      ),
    removeMember: (session: string, moveId: string, userId: string) =>
      req<{ ok: true }>(`/v1/moves/${moveId}/members/${userId}`, { method: 'DELETE' }, session),

    createPhoto: (session: string, moveId: string, link: { itemId?: string; boxId?: string }) =>
      req<{ photoId: string; uploadPath: string }>(
        `/v1/moves/${moveId}/photos`,
        { method: 'POST', body: JSON.stringify(link) },
        session,
      ),
  };
}
