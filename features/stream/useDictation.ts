// The mic state machine. Owns the dictation session, the interim transcript, the
// "got it / didn't catch that" beat and its timer. It parses what was heard and hands
// the result to the caller; what happens to the ledger is the caller's business.
// Dictation is simulated where the native recognizer is unavailable (lib/dictation).
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { listen, isDictationSimulated, type DictationSession } from '@/lib/dictation';
import { parseList, parseUtterance, type ParsedItem } from '@/lib/streamParse';

import type { Mic } from './types';
import { MIC } from './types';

const GOTIT_BEAT_MS = 2000;

export type DictationHandlers = {
  /**
   * One utterance finished. `target` is the item being re-said (Redo last), else a new
   * item is meant. `parsed.name` is '' when nothing usable was heard.
   */
  onUtterance: (parsed: ParsedItem, target: string | null) => void;
  /** A whole-box list finished (Photos-off). Empty when nothing usable was heard. */
  onList: (parsed: ParsedItem[]) => void;
};

/** Mic state machine over lib/dictation: start/stop listening, transcript, parse on final. */
export function useDictation(handlers: DictationHandlers) {
  const [mic, setMic] = useState<Mic>(MIC.ready);
  const [transcript, setTranscript] = useState('');
  const [lastBatch, setLastBatch] = useState(0);

  const dictRef = useRef<DictationSession | null>(null);
  const gotitTmo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetRef = useRef<string | null>(null);
  const listModeRef = useRef(false);
  // Handlers are read through a ref so a session started on one render sees the
  // latest ledger callbacks when it finishes on a later one.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const simulated = isDictationSimulated();

  useEffect(
    () => () => {
      dictRef.current?.cancel();
      if (gotitTmo.current) clearTimeout(gotitTmo.current);
    },
    [],
  );

  const scheduleReady = () => {
    if (gotitTmo.current) clearTimeout(gotitTmo.current);
    gotitTmo.current = setTimeout(() => setMic((m) => (m === MIC.listening ? m : MIC.ready)), GOTIT_BEAT_MS);
  };

  const finalizeList = (raw: string) => {
    listModeRef.current = false;
    const parsed = parseList(raw);
    if (gotitTmo.current) clearTimeout(gotitTmo.current);
    if (!parsed.length) {
      setMic(MIC.fail);
      setTranscript('');
      scheduleReady();
      return;
    }
    handlersRef.current.onList(parsed);
    setMic(MIC.gotIt);
    setTranscript('');
    setLastBatch(parsed.length);
    scheduleReady();
  };

  const finalize = (raw: string) => {
    if (listModeRef.current) return finalizeList(raw);
    const text = (raw || '').trim();
    const p = text ? parseUtterance(text) : { name: '', qty: null, value: null };
    const target = targetRef.current;
    targetRef.current = null;
    handlersRef.current.onUtterance(p, target);
    setMic(p.name ? MIC.gotIt : MIC.fail);
    setTranscript('');
    scheduleReady();
  };

  /** Start listening. `targetId` re-says an existing item; `listMode` hears a whole box. */
  const beginListen = (targetId: string | null, listMode = false) => {
    targetRef.current = targetId;
    listModeRef.current = listMode;
    setMic(MIC.listening);
    setTranscript('');
    setLastBatch(0);
    dictRef.current?.cancel();
    dictRef.current = listen(
      { listMode },
      {
        onInterim: (t) => setTranscript(t),
        onFinal: (t) => {
          dictRef.current = null;
          finalize(t);
        },
        onError: (e) => {
          // Only the mic/speech-permission denial needs special handling — it must NOT
          // create a fake item. Genuine recognition errors are followed by onEnd →
          // finalize, which captures whatever was heard, so we let those fall through.
          if (!(e instanceof Error && e.message === 'PERMISSION')) return;
          dictRef.current = null;
          if (gotitTmo.current) clearTimeout(gotitTmo.current);
          targetRef.current = null;
          listModeRef.current = false;
          setTranscript('');
          setMic(MIC.ready);
          Alert.alert(
            'Microphone access needed',
            'Tuck needs microphone and speech access to add items by voice. Turn them on in Settings › Tuck, then try again.',
          );
        },
      },
    );
  };

  /** Finish the current utterance now (the big button while listening). */
  const stop = () => dictRef.current?.stop();

  /** Drop a live session without producing an item (closing the screen). */
  const cancel = () => {
    dictRef.current?.cancel();
    dictRef.current = null;
    setMic(MIC.ready);
  };

  return { mic, setMic, transcript, lastBatch, simulated, beginListen, stop, cancel };
}
