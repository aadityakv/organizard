// Tiny copy helpers shared by screens.

/** The noun in singular or regular English plural: plural(1, 'box') → 'box', plural(2, 'box') → 'boxes'. */
export const plural = (n: number, noun: string): string =>
  n === 1 ? noun : `${noun}${noun.endsWith('x') ? 'es' : 's'}`;

/** A room with its destination: "Kitchen · NYC kitchen", or just the name; empty when there is no room. */
export const roomLabel = (room?: { name: string; dest: string | null } | null): string =>
  room ? (room.dest ? `${room.name} · ${room.dest}` : room.name) : '';

/** "1 item", "3 items". */
export const countOf = (n: number, noun: string): string => `${n} ${plural(n, noun)}`;
