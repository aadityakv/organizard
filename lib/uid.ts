// Small stable-ish id generator for newly created entities.
/** Prefixes that make an id's kind readable at a glance ("b_…" is a box). */
export const ID_PREFIX = {
  room: 'r',
  box: 'b',
  item: 'i',
  status: 'st',
  marker: 'mk',
  move: 'mv',
  mutation: 'c',
  migration: 'mig',
  photo: 'ph',
  streamItem: 's',
  voiceItem: 'v',
} as const;

let counter = 0;
/** Prefixed, time-ordered id for new entities (unique per device, not globally). */
export const uid = (prefix = 'id'): string =>
  `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}`;
