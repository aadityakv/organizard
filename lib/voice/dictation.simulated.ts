// DEVELOPMENT ONLY. Fakes dictation on the simulator (no microphone) so the streaming
// flow can be exercised end to end. Never part of a production path: lib/voice/dictation
// only reaches for this under __DEV__, and the function throws if it runs otherwise.
import type { DictationCallbacks, DictationSession } from './dictation';

const PAUSE_MS = 420;

// Sample utterances for the simulated fallback: single items (photos on) and whole
// boxes (voice only).
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

/** Stream a canned utterance through the dictation callbacks. Dev builds only. */
export function simulatedListen(opts: { listMode?: boolean }, cb: DictationCallbacks): DictationSession {
  if (!__DEV__) throw new Error('simulatedListen is a development-only fallback');
  const pool = opts.listMode ? SAMPLES_LIST : SAMPLES;
  const idx = opts.listMode
    ? (listIdx = (listIdx + 1) % pool.length)
    : (singleIdx = (singleIdx + 1) % pool.length);
  const text = pool[idx];

  let cancelled = false;
  let done = false;
  let i = 0;
  let finishTimer: ReturnType<typeof setTimeout> | undefined;
  const fire = () => {
    if (done || cancelled) return;
    done = true;
    cb.onFinal(text);
  };
  const iv = setInterval(() => {
    if (cancelled || done) return;
    i += 2;
    cb.onInterim?.(text.slice(0, i));
    if (i >= text.length) {
      clearInterval(iv);
      finishTimer = setTimeout(fire, PAUSE_MS);
    }
  }, 48);
  const clear = () => {
    clearInterval(iv);
    if (finishTimer) clearTimeout(finishTimer);
  };

  return {
    cancel: () => {
      cancelled = true;
      clear();
    },
    stop: () => {
      clear();
      fire();
    }, // finalize immediately with the full sample
  };
}
