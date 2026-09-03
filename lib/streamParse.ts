// Voice parsing for Streaming Mode — turns a spoken utterance into an item
// { name, qty, value } with the three fields parsed in any order, plus a list
// splitter for "talk a whole box in" voice-only mode. Ported 1:1 from the Claude
// Design prototype ("Streaming Mode Prototype"); this is the parsing source of
// truth shared by the simulated path now and the on-device speech path later.
//
// `value` is in dollars (matches the client Item.value); the caller converts to
// cents for the server. `iconFor` returns a kebab Lucide name the Icon component
// resolves (falling back to "package").

const WORD_NUMS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

/** Parse an English number phrase ("two hundred twenty", "forty") to a number, or null. */
export function wordNum(str: string): number | null {
  const toks = str
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);
  let total = 0;
  let cur = 0;
  let any = false;
  for (const t of toks) {
    if (WORD_NUMS[t] != null) {
      cur += WORD_NUMS[t];
      any = true;
    } else if (t === 'hundred') {
      cur = (cur || 1) * 100;
      any = true;
    } else if (t === 'thousand') {
      total += (cur || 1) * 1000;
      cur = 0;
      any = true;
    } else if (t === 'a' || t === 'an' || t === 'and') {
      continue;
    } else if (/^\d+$/.test(t)) {
      cur += parseInt(t, 10);
      any = true;
    } else return null;
  }
  return any ? total + cur : null;
}

export type ParsedItem = { name: string; qty: number | null; value: number | null };

/**
 * Find the shortest trailing suffix of `tokens` that's a valid positive number
 * ("cast iron skillet eighty" → 80 from index 3). Lets a spoken value/qty sit
 * after a multi-word name once commas are gone, without swallowing the name.
 */
function trailingNumber(tokens: string[]): { value: number; fromIndex: number } | null {
  for (let start = 0; start < tokens.length; start++) {
    const v = wordNum(tokens.slice(start).join(' '));
    if (v != null && v > 0) return { value: v, fromIndex: start };
  }
  return null;
}

/** Parse a single spoken item ("stoneware mugs, six of them, fifty four dollars"). */
export function parseUtterance(raw: string): ParsedItem {
  let s = ' ' + raw.toLowerCase().replace(/[.,!?]/g, ' ') + ' ';
  let value: number | null = null;
  let qty: number | null = null;
  let m: RegExpMatchArray | null;

  // value: "$54" | "54 dollars/bucks/usd" | "...fifty four dollars"
  if ((m = s.match(/\$\s*(\d+(?:\.\d+)?)/))) {
    value = parseFloat(m[1]);
    s = s.replace(m[0], ' ');
  } else if ((m = s.match(/(\d+(?:\.\d+)?)\s*(?:dollars?|bucks?|usd)\b/))) {
    value = parseFloat(m[1]);
    s = s.replace(m[0], ' ');
  } else if ((m = s.match(/((?:[a-z]+[\s-]){1,6}?)(?:dollars?|bucks?|usd)\b/))) {
    // The capture may include leading name words; take only the trailing number run
    // as the value and put the name words back ("cast iron skillet eighty" → 80 + name).
    const toks = m[1]
      .trim()
      .split(/[\s-]+/)
      .filter(Boolean);
    const tn = trailingNumber(toks);
    if (tn) {
      value = tn.value;
      s = s.replace(m[0], ' ' + toks.slice(0, tn.fromIndex).join(' ') + ' ');
    }
  }

  // qty: "6 of them" | "...six of them" | "x6/times 6"
  if ((m = s.match(/(\d+)\s*of\s*(?:them|these|those)/))) {
    qty = parseInt(m[1], 10);
    s = s.replace(m[0], ' ');
  } else if ((m = s.match(/((?:[a-z]+[\s-]){1,4}?)of\s+(?:them|these|those)/))) {
    const toks = m[1]
      .trim()
      .split(/[\s-]+/)
      .filter(Boolean);
    const tn = trailingNumber(toks);
    if (tn) {
      qty = tn.value;
      s = s.replace(m[0], ' ' + toks.slice(0, tn.fromIndex).join(' ') + ' ');
    }
  } else if ((m = s.match(/\b(?:x|times)\s*(\d+)\b/))) {
    qty = parseInt(m[1], 10);
    s = s.replace(m[0], ' ');
  }

  // qty: leading count ("three mugs")
  if (qty == null) {
    let lm: RegExpMatchArray | null;
    if ((lm = s.match(/^\s*(\d+)\s+(?=[a-z])/))) {
      qty = parseInt(lm[1], 10);
      s = s.replace(lm[0], ' ');
    } else if (
      (lm = s.match(/^\s*(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?=[a-z])/))
    ) {
      qty = wordNum(lm[1].trim());
      s = s.replace(lm[0], ' ');
    }
  }

  // name: strip leading article + filler words
  s = s.replace(/^\s*(a|an|the)\s+/i, ' ');
  s = s.replace(/\b(about|around|maybe|roughly|worth|i think|like|uh|um|say|total|each|it's|its)\b/g, ' ');
  let name = s.replace(/\s+/g, ' ').trim();
  if (name) name = name.charAt(0).toUpperCase() + name.slice(1);
  return { name, qty, value };
}

/** Split one "list" utterance into multiple items (voice-only mode). */
export function parseList(raw: string): ParsedItem[] {
  const text = (raw || '').toLowerCase();
  const chunks = text.split(/[,;\n]|\band\b|\bthen\b|\bplus\b|\balso\b/);
  const items: ParsedItem[] = [];
  for (const c of chunks) {
    if (!c.trim()) continue;
    const p = parseUtterance(c.trim());
    if (p.name) items.push(p);
  }
  return items;
}

/** Best-guess category icon (kebab Lucide name) from an item name. */
export function iconFor(name: string): string {
  const n = (name || '').toLowerCase();
  const rules: [RegExp, string][] = [
    [/skillet|pan\b|pot\b/, 'cooking-pot'],
    [/mug|cup|coffee/, 'coffee'],
    [/plate|dish|bowl/, 'utensils'],
    [/knife|knives|cutlery/, 'utensils-crossed'],
    [/mixer|blender/, 'blend'],
    [/book|novel/, 'book'],
    [/record|vinyl/, 'disc-3'],
    [/lamp|light/, 'lamp'],
    [/shirt|coat|cloth|sweater|jacket|dress/, 'shirt'],
    [/cable|charger|cord/, 'cable'],
    [/monitor|tv\b|screen/, 'monitor'],
    [/keyboard/, 'keyboard'],
    [/frame|photo|picture|art/, 'image'],
    [/towel|blanket|comforter|pillow|bed/, 'bed'],
    [/speaker|turntable|audio|headphone/, 'audio-lines'],
    [/glass|wine|bottle/, 'wine'],
    [/plant/, 'sprout'],
    [/game|console/, 'gamepad-2'],
    [/tool|drill|hammer/, 'wrench'],
    [/shoe|boot|sneaker/, 'footprints'],
  ];
  for (const [re, ic] of rules) {
    if (re.test(n)) return ic;
  }
  return 'package';
}
