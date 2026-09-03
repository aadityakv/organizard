// Building outbox entries. Every write action does `enqueue(mutation('type', payload))`;
// the envelope (client id for idempotency, timestamp for last-write-wins) lives here so
// it is impossible to forget a field.
import { uid } from '@/lib/uid';
import { ROLE_REQUIRED, type Mutation, type MutationType } from '@/shared';

type PayloadOf<T extends MutationType> = Extract<Mutation, { type: T }>['payload'];

/** Wrap a payload in the mutation envelope the server expects. */
export function mutation<T extends MutationType>(type: T, payload: PayloadOf<T>): Mutation {
  return { type, clientId: uid('c'), ts: Date.now(), payload } as Extract<Mutation, { type: T }>;
}

/**
 * Mutation types this build understands. Derived from the contract so a new type is
 * automatically "known"; used by the persist migration to drop legacy/poison outbox
 * entries that would otherwise wedge sync forever.
 */
export const KNOWN_MUTATION_TYPES: ReadonlySet<string> = new Set(Object.keys(ROLE_REQUIRED));
