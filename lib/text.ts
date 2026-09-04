// Tiny copy helpers shared by screens.

/** The noun in singular or regular English plural: plural(1, 'box') → 'box', plural(2, 'box') → 'boxes'. */
export const plural = (n: number, noun: string): string =>
  n === 1 ? noun : `${noun}${noun.endsWith('x') ? 'es' : 's'}`;

/** "1 item", "3 items". */
export const countOf = (n: number, noun: string): string => `${n} ${plural(n, noun)}`;
