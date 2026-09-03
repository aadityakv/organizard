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

export type DictationSession = {
  /** Discard the utterance (no onFinal). */
  cancel: () => void;
  /** Finish now — stop the mic and fire onFinal with whatever's been heard. */
  stop: () => void;
};
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
      finishTimer = setTimeout(fire, 420);
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
  let hardTimeout: ReturnType<typeof setTimeout> | undefined;
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;

  const clearTimers = () => {
    if (hardTimeout) clearTimeout(hardTimeout);
    if (silenceTimer) clearTimeout(silenceTimer);
  };
  const finalize = () => {
    if (done || cancelled) return;
    done = true;
    clearTimers();
    cb.onFinal(lastTranscript.trim());
  };
  // Auto-finish a short pause after the user stops talking — but only once we've
  // actually heard something, so it never fires on dead air.
  const resetSilence = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(
      () => {
        if (lastTranscript.trim()) speech?.stop();
      },
      opts.listMode ? 1800 : 1300,
    );
  };

  requestSpeechPermissions()
    .then((granted) => {
      if (cancelled) return;
      if (!granted) {
        // Real device, mic/speech denied — surface it instead of faking items.
        // (Simulated dictation only makes sense where the native module is absent.)
        permissionDenied = true;
        done = true;
        clearTimers();
        cb.onError?.(new Error('PERMISSION'));
        return;
      }
      permissionDenied = false;
      speech = startSpeech(
        (transcript) => {
          if (cancelled) return;
          lastTranscript = transcript;
          cb.onInterim?.(transcript);
          resetSilence();
        },
        () => finalize(), // onEnd → treat the last transcript as final
        (msg) => cb.onError?.(msg),
      );
      resetSilence();
      // Safety backstop only — manual stop + silence detection handle the normal case.
      hardTimeout = setTimeout(() => speech?.stop(), opts.listMode ? 25000 : 12000);
    })
    .catch((e) => {
      if (cancelled) return;
      done = true;
      clearTimers();
      cb.onError?.(e);
    });

  return {
    cancel: () => {
      cancelled = true;
      clearTimers();
      speech?.stop();
    },
    stop: () => {
      // User tapped "done": finish now with whatever's been heard.
      clearTimers();
      speech?.stop();
    },
  };
}
