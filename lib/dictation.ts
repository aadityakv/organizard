// Dictation seam for Streaming Mode. The streaming screen talks only to `listen()`
// and `isDictationSimulated()` — it doesn't care whether speech is real or faked.
//
// Phase 1 (now): a simulated path that streams a sample utterance as interim text
// then fires onFinal, so the whole capture flow is testable on the simulator (where
// the mic doesn't work). It mirrors the design prototype's fallback.
//
// Phase 2 (later, device-only): a native on-device iOS speech-recognition module
// (SFSpeechRecognizer) plugs in here behind the same interface; when it's present
// and mic+speech permission is granted, listen() uses it and isDictationSimulated()
// returns false. Until then we simulate and the UI shows a "simulating" note.

// Single-item samples (Photos-on mode) and list samples (voice-only mode),
// straight from the design prototype.
const SAMPLES = [
  'stand mixer, two hundred twenty dollars',
  'stoneware mugs, six of them, fifty four dollars',
  'cast iron skillet, eighty bucks',
  'dinner plates, eight of them, ninety six dollars',
  'chef knife set, one hundred forty dollars',
  'table lamp, twenty five dollars',
  'wool coats, three of them, two hundred dollars',
];
const SAMPLES_LIST = [
  'paperbacks, a desk lamp, three coffee mugs, and a phone charger',
  'winter coats, two scarves, a pair of boots, and a wool blanket',
  'dinner plates, six wine glasses, a salad bowl, and a cheese board',
  'board games, a bluetooth speaker, four picture frames, and a throw pillow',
  'a cast iron skillet, two cutting boards, a stand mixer, and a kettle',
];

let singleIdx = -1;
let listIdx = -1;

export type DictationSession = { cancel: () => void };
export type DictationCallbacks = {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (e: unknown) => void;
};

/** True while the mic is faked (no native speech module / permission yet). */
export function isDictationSimulated(): boolean {
  // Phase 2 will return false once the native recognizer is available + authorized.
  return true;
}

/**
 * Listen for one utterance. Streams interim text via onInterim, then onFinal with the
 * full transcript. Returns a handle whose cancel() stops it. `listMode` picks the
 * "talk a whole box in" sample pool.
 */
export function listen(opts: { listMode?: boolean }, cb: DictationCallbacks): DictationSession {
  const pool = opts.listMode ? SAMPLES_LIST : SAMPLES;
  const idx = opts.listMode ? (listIdx = (listIdx + 1) % pool.length) : (singleIdx = (singleIdx + 1) % pool.length);
  const text = pool[idx];

  let cancelled = false;
  let i = 0;
  let finishTimer: ReturnType<typeof setTimeout> | undefined;
  const iv = setInterval(() => {
    if (cancelled) return;
    i += 2;
    cb.onInterim?.(text.slice(0, i));
    if (i >= text.length) {
      clearInterval(iv);
      finishTimer = setTimeout(() => { if (!cancelled) cb.onFinal(text); }, 420);
    }
  }, 48);

  return {
    cancel: () => {
      cancelled = true;
      clearInterval(iv);
      if (finishTimer) clearTimeout(finishTimer);
    },
  };
}
