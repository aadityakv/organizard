// Shared domain models — imported by BOTH the Worker and (later) the client,
// so the two can't drift. Money is integer cents; mutable rows carry
// updatedAt (ms) + deletedAt (tombstone) for last-write-wins delta sync.

export type Role = 'owner' | 'editor' | 'viewer';

export interface Move {
  id: string;
  name: string;
  from?: string | null;
  to?: string | null;
  targetDate?: string | null;
  ownerId: string;
  updatedAt: number;
}

export interface Room {
  id: string;
  moveId: string;
  name: string;
  dest?: string | null;
  icon: string;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface Status {
  id: string;
  moveId: string;
  label: string;
  color: string;
  custom: boolean;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface Marker {
  id: string;
  moveId: string;
  label: string;
  color: string;
  icon: string;
  custom: boolean;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface Box {
  id: string;
  moveId: string;
  roomId: string;
  number: number;
  name: string;
  color: string;
  statusId: string;
  coverPhotoId?: string | null;
  markerIds: string[];
  updatedAt: number;
  deletedAt?: number | null;
}

export interface Item {
  id: string;
  moveId: string;
  boxId: string;
  name: string;
  qty: number;
  valueCents: number;
  note?: string | null;
  icon?: string | null;
  markerIds: string[];
  photoIds: string[];
  updatedAt: number;
  deletedAt?: number | null;
}

export interface Member {
  id: string;
  moveId: string;
  userId: string;
  role: Role;
  name: string;
  you?: boolean;
}
