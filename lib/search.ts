// Find's matching engine, pure and node-testable. A query is tokenized and stemmed;
// every query token must match somewhere in a document (AND across tokens), where a
// token matches exactly, as a prefix (type-ahead), through a small household synonym
// table, or with a typo. Each match kind has a quality, and the document's score is the
// sum over query tokens of the best quality times the field's weight, so a name hit
// outranks a note hit. The store's `searchMove` builds the fields; this file knows
// nothing about boxes or items.

/** One searchable string on a document, with how much a hit in it is worth. */
export type Field<K extends string> = { kind: K; text: string; weight: number };

/** A matching document with its score and the kinds of field that matched, in field order. */
export type Hit<T, K extends string> = { doc: T; score: number; matched: K[] };

/** Lowercase, drop accents and punctuation, collapse whitespace. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const IRREGULAR: Record<string, string> = {
  knives: 'knife',
  wives: 'wife',
  lives: 'life',
  shelves: 'shelf',
  leaves: 'leaf',
  halves: 'half',
  scarves: 'scarf',
  children: 'child',
  feet: 'foot',
  teeth: 'tooth',
  mice: 'mouse',
  geese: 'goose',
  people: 'person',
  men: 'man',
  women: 'woman',
  // Singulars that end in s and would otherwise lose it.
  christmas: 'christmas',
  canvas: 'canvas',
  atlas: 'atlas',
  gas: 'gas',
  lens: 'lens',
  chess: 'chess',
  mattress: 'mattress',
};

/** Reduce an English plural to its singular; singular and short words pass through. */
export function stem(tok: string): string {
  const irregular = IRREGULAR[tok];
  if (irregular) return irregular;
  if (tok.length > 4 && tok.endsWith('ies')) return `${tok.slice(0, -3)}y`;
  if (tok.length > 4 && /(ss|sh|ch|x|z)es$/.test(tok)) return tok.slice(0, -2);
  if (tok.length >= 4 && tok.endsWith('s') && !/(ss|us|is)$/.test(tok)) return tok.slice(0, -1);
  return tok;
}

/** Normalized, stemmed word list for a string. */
export function tokenize(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(' ').map(stem) : [];
}

// Words people use interchangeably for the same household thing. Kept tight: a loose
// pair (cable/charger) floods results instead of helping. Stored stemmed.
const SYNONYM_GROUPS: string[][] = [
  ['xmas', 'christmas'],
  ['tv', 'television', 'telly'],
  ['couch', 'sofa', 'settee'],
  ['fridge', 'refrigerator'],
  ['cup', 'mug'],
  ['pan', 'skillet', 'frypan'],
  ['pot', 'saucepan'],
  ['plate', 'dish'],
  ['cutlery', 'silverware', 'flatware'],
  ['sneaker', 'trainer'],
  ['sweater', 'jumper', 'pullover'],
  ['pant', 'trouser'],
  ['flashlight', 'torch'],
  ['bike', 'bicycle'],
  ['phone', 'cellphone', 'mobile'],
  ['pillow', 'cushion'],
  ['cable', 'cord', 'wire'],
  ['doc', 'document', 'paperwork'],
  ['med', 'medicine', 'medication'],
  ['laptop', 'notebook', 'macbook'],
  ['pc', 'computer', 'desktop'],
  ['blanket', 'duvet', 'comforter', 'quilt'],
  ['photo', 'picture', 'photograph'],
  ['kid', 'child', 'baby', 'toddler'],
  ['bathroom', 'bath', 'washroom', 'restroom'],
  ['garage', 'shed'],
  ['lounge', 'living', 'sitting'],
];

const SYNONYM_ID = new Map<string, number>();
SYNONYM_GROUPS.forEach((group, i) => group.forEach((w) => SYNONYM_ID.set(stem(w), i)));

/** Optimal-string-alignment (Damerau-Levenshtein) distance, capped: returns cap + 1 once exceeded. */
function editDistance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i][0] = i;
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** How many typos a query word of this length may carry before it stops matching. */
const typoBudget = (len: number): number => (len >= 8 ? 2 : len >= 4 ? 1 : 0);

const QUALITY = { exact: 1, synonym: 0.9, prefix: 0.8, typo: 0.6 } as const;

/** Quality of a query token against one document token, or 0 for no match. */
function tokenQuality(q: string, d: string): number {
  if (q === d) return QUALITY.exact;
  const qGroup = SYNONYM_ID.get(q);
  if (qGroup != null && qGroup === SYNONYM_ID.get(d)) return QUALITY.synonym;
  if (q.length >= 2 && d.startsWith(q)) return QUALITY.prefix;
  const budget = typoBudget(q.length);
  if (budget > 0 && editDistance(q, d, budget) <= budget) return QUALITY.typo;
  return 0;
}

/**
 * Rank `docs` against `query`. A document is a hit when every query token matches in at
 * least one of its fields; hits are sorted by score, ties keeping input order. Blank
 * queries return nothing. Fresh array per call.
 */
export function searchDocs<T, K extends string>(
  query: string,
  docs: readonly T[],
  fieldsOf: (doc: T) => Field<K>[],
): Hit<T, K>[] {
  const qToks = tokenize(query);
  if (qToks.length === 0) return [];
  const hits: Hit<T, K>[] = [];
  for (const doc of docs) {
    const fields = fieldsOf(doc)
      .map((f) => ({ ...f, toks: tokenize(f.text) }))
      .filter((f) => f.toks.length > 0);
    let score = 0;
    const matched = new Set<K>();
    let all = true;
    for (const q of qToks) {
      let best = 0;
      let bestKind: K | null = null;
      for (const f of fields) {
        for (const d of f.toks) {
          const v = tokenQuality(q, d) * f.weight;
          if (v > best) {
            best = v;
            bestKind = f.kind;
          }
        }
      }
      if (best === 0 || bestKind === null) {
        all = false;
        break;
      }
      score += best;
      matched.add(bestKind);
    }
    if (all) hits.push({ doc, score, matched: orderByField(matched, fields) });
  }
  return hits.sort((a, z) => z.score - a.score);
}

/** The matched kinds in the order their fields were declared, so callers get a stable list. */
function orderByField<K extends string>(matched: Set<K>, fields: { kind: K }[]): K[] {
  const out: K[] = [];
  for (const f of fields) if (matched.has(f.kind) && !out.includes(f.kind)) out.push(f.kind);
  return out;
}
