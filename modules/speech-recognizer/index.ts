// JS surface for the native on-device speech recognizer (iOS only). Where the module
// is absent (Android, or a build without it) every function reports unavailable and
// lib/voice/dictation surfaces that to the user.
import { requireOptionalNativeModule } from 'expo';

type Sub = { remove: () => void };
type NativeSpeech = {
  isAvailable: () => boolean;
  requestPermissions: () => Promise<boolean>;
  start: () => Promise<void>;
  stop: () => void;
  addListener: (event: string, listener: (payload: unknown) => void) => Sub;
};

const native = requireOptionalNativeModule<NativeSpeech>('SpeechRecognizer');

/** True when the recognizer is present and currently usable (iOS, online or on-device). */
export function isSpeechAvailable(): boolean {
  try {
    return !!native && native.isAvailable();
  } catch {
    return false;
  }
}

/** Request Speech + microphone permission. Resolves true only if both are granted. */
export function requestSpeechPermissions(): Promise<boolean> {
  if (!native) return Promise.resolve(false);
  return native.requestPermissions().catch(() => false);
}

export type SpeechHandle = { stop: () => void };

/**
 * Start streaming recognition. `onResult(transcript, isFinal)` fires with each partial
 * transcript; `onEnd` fires exactly once when recognition stops (treat the last
 * transcript as final). Returns a handle whose stop() ends the utterance.
 */
export function startSpeech(
  onResult: (transcript: string, isFinal: boolean) => void,
  onEnd: () => void,
  onError: (message: string) => void,
): SpeechHandle {
  if (!native) {
    onEnd();
    return { stop: () => {} };
  }
  const subs: Sub[] = [];
  let ended = false;
  const cleanup = () => {
    for (const s of subs) s.remove();
    subs.length = 0;
  };
  const end = () => {
    if (ended) return;
    ended = true;
    cleanup();
    onEnd();
  };

  subs.push(
    native.addListener('onResult', (e) => {
      const r = e as { transcript: string; isFinal: boolean };
      onResult(r.transcript, r.isFinal);
    }),
  );
  subs.push(
    native.addListener('onError', (e) => {
      onError((e as { message: string }).message);
      end();
    }),
  );
  subs.push(native.addListener('onEnd', () => end()));

  native.start().catch((err: unknown) => {
    // A failed start rejects AND emits onError natively — same failure. The event
    // arrives first and ends the session; don't surface the rejection twice.
    if (ended) return;
    onError(String(err));
    end();
  });

  return {
    stop: () => {
      try {
        native.stop();
      } catch {
        /* already stopped */
      }
    },
  };
}
