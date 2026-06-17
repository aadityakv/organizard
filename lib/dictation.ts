// Dictation seam for Streaming Mode. The streaming screen talks only to `listen()`
// and `isDictationSimulated()` — it doesn't care whether speech is real or faked.
//
// On a device with the native on-device speech module (iOS, mic+speech granted),
// `listen()` streams real recognition. Otherwise (simulator, Android, permission
// denied) it falls back to a simulated path that streams a sample utterance — so the
// whole capture flow stays testable on the simulator (where the mic doesn't work).
import { isSpeechAvailable, requestSpeechPermissions, startSpeech } from '@/modules/speech-recognizer';

// Single-item samples (Photos-on mode) and list samples (voice-only mode), from the
// design prototype — used only by the simulated fallback.
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
// Set when the native module exists but mic/speech permission was denied, so the
// fallback note can still surface.
let permissionDenied = false;

export type DictationSession = { cancel: () => void };
export type DictationCallbacks = {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (e: unknown) => void;
};

/** True while the mic is faked (no native speech module / not available / denied). */
export function isDictationSimulated(): boolean {
  return !isSpeechAvailable() || permissionDenied;
}

/** Simulated dictation: stream a sample utterance, then fire onFinal. */
function simulate(opts: { listMode?: boolean }, cb: DictationCallbacks): DictationSession {
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

/**
 * Listen for one utterance. Streams interim text via onInterim, then onFinal with the
 * full transcript. `listMode` lengthens the capture window (talk a whole box in).
 */
export function listen(opts: { listMode?: boolean }, cb: DictationCallbacks): DictationSession {
  if (!isSpeechAvailable()) return simulate(opts, cb);

  let cancelled = false;
  let done = false;
  let lastTranscript = '';
  let speech: { stop: () => void } | null = null;
  let inner: DictationSession | null = null; // simulate fallback if permission denied
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const finalize = () => {
    if (done || cancelled) return;
    done = true;
    if (timeout) clearTimeout(timeout);
    cb.onFinal(lastTranscript);
  };

  requestSpeechPermissions()
    .then((granted) => {
      if (cancelled) return;
      if (!granted) {
        permissionDenied = true;
        inner = simulate(opts, cb);
        return;
      }
      permissionDenied = false;
      speech = startSpeech(
        (transcript) => { if (!cancelled) { lastTranscript = transcript; cb.onInterim?.(transcript); } },
        () => finalize(), // onEnd → treat the last transcript as final
        (msg) => cb.onError?.(msg),
      );
      // Backstop: stop the mic after a window so the utterance finalizes even without
      // the recognizer's own endpointing (single item vs. a whole-box list).
      timeout = setTimeout(() => speech?.stop(), opts.listMode ? 12000 : 6000);
    })
    .catch(() => { if (!cancelled) inner = simulate(opts, cb); });

  return {
    cancel: () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      speech?.stop();
      inner?.cancel();
    },
  };
}
