// Small stable-ish id generator for newly created entities.
let counter = 0;
export const uid = (prefix = 'id'): string =>
  `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}`;
