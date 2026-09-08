import { useCallback, useEffect, useRef, useState } from 'react';

import {
  activateSession,
  configureDictationSession,
  deactivateSession,
  ensureMicPermission,
  explainMicDenied,
} from '@/core/audio';
import { describeError } from '@/core/llama';
import {
  startTranscribing,
  type TranscriberHandle,
} from './speech/transcriber';
import { resolveSpeechAsset, resolveVadAsset } from './store';

/**
 * Dictation for the composer: hold the microphone, stream what was said into
 * the text the caller already owns.
 *
 * The transcript is handed over rather than sent — the whole point of dictating
 * into the composer instead of into a voice call is that it can be corrected
 * first.
 */

export type DictationState = 'idle' | 'starting' | 'listening' | 'error';

export interface Dictation {
  state: DictationState;
  /** 0..1 microphone loudness, for the listening affordance. */
  level: number;
  error?: string;
  toggle: () => void;
  stop: () => void;
}

export function useDictation(onTranscript: (text: string) => void): Dictation {
  const [state, setState] = useState<DictationState>('idle');
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string>();

  const handle = useRef<TranscriberHandle | undefined>(undefined);
  // The callback identity changes every render as the composer's text does;
  // reading it from a ref keeps `start` stable and avoids restarting the mic.
  const sink = useRef(onTranscript);
  sink.current = onTranscript;

  const stop = useCallback(() => {
    const current = handle.current;
    handle.current = undefined;
    setState('idle');
    setLevel(0);
    if (current) {
      void current.stop().then(() => deactivateSession());
    }
  }, []);

  const start = useCallback(async () => {
    const speech = resolveSpeechAsset();
    if (!speech) {
      // Callers gate on `useCanDictate`, so reaching here means the model was
      // deleted mid-session. Nothing to do but stay quiet.
      return;
    }

    setState('starting');
    setError(undefined);

    try {
      const permission = await ensureMicPermission();
      if (permission !== 'Granted') {
        setState('idle');
        explainMicDenied();
        return;
      }

      configureDictationSession();
      // iOS will not let AVAudioEngine start against an inactive session — the
      // recorder fails with a bare NativeAudioRecorder error rather than
      // anything about the session. Android is lenient, so this only shows up
      // on one platform.
      await activateSession();

      handle.current = await startTranscribing({
        speech,
        vad: resolveVadAsset(),
        onText: text => sink.current(text),
        onLevel: setLevel,
        onError: message => {
          setError(message);
          setState('error');
        },
      });
      setState('listening');
    } catch (cause) {
      // The native recorder reports a bare domain error when it cannot open
      // the microphone, which tells the user nothing they can act on. Name the
      // usual culprits instead and keep the detail for the logs.
      const detail = describeError(cause);
      setError(
        detail.includes('native recorder') || detail.includes('audio engine')
          ? 'Could not open the microphone. Close anything else using it and try again.'
          : detail,
      );
      setState('error');
      void deactivateSession();
    }
  }, []);

  const toggle = useCallback(() => {
    if (handle.current) {
      stop();
    } else {
      void start();
    }
  }, [start, stop]);

  // Leaving the screen with the microphone open would keep recording behind a
  // view the user has already dismissed.
  useEffect(() => stop, [stop]);

  return { state, level, error, toggle, stop };
}
