// Id + token helpers. crypto is global in Workers and Node 20+.

export const newId = (): string => crypto.randomUUID();

/** A 256-bit random hex token (sessions, magic links, invites). */
export const newToken = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};
