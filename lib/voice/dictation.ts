// Dictation seam for Streaming Mode. The streaming screen talks only to `listen()`:
// on iOS with the native on-device recognizer it streams real recognition; anywhere
// the recognizer is missing (Android, a build without the module) it reports
// UNAVAILABLE and captures nothing. Development builds substitute the simulator from
// dictation.simulated.ts so the flow can be exercised where there is no microphone.
import { isSpeechAvailable, requestSpeechPermissions, startSpeech } from '@/modules/speech-recognizer';

import { simulatedListen } from './dictation.simulated';

/** Error messages `listen` reports through onError; callers switch on these. */
export const DICTATION_ERROR = { permission: 'PERMISSION', unavailable: 'UNAVAILABLE' } as const;

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

/** True only in a development build that is faking the mic (simulator, no recognizer). */
export function isDictationSimulated(): boolean {
  return __DEV__ && !isSpeechAvailable();
}

/**
 * Listen for one utterance: interim text via onInterim, then onFinal with the full
 * transcript. Without the native recognizer this reports UNAVAILABLE (or, in a
 * development build, hands over to the simulator so the flow can still be tried).
 */
export function listen(opts: { listMode?: boolean }, cb: DictationCallbacks): DictationSession {
  if (!isSpeechAvailable()) {
    if (__DEV__) return simulatedListen(opts, cb);
    queueMicrotask(() => cb.onError?.(new Error(DICTATION_ERROR.unavailable)));
    return { cancel: () => {}, stop: () => {} };
  }

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
        done = true;
        clearTimers();
        cb.onError?.(new Error(DICTATION_ERROR.permission));
        return;
      }
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
