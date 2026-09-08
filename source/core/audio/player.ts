import {
  AudioBufferQueueSourceNode,
  AudioContext,
} from 'react-native-audio-api';

import { envelopeOf, normalizeLevel } from './pcm';

/**
 * Speech playback: a queue of PCM chunks played back to back, with a loudness
 * signal for the orb.
 *
 * One queue node serves a whole assistant turn so consecutive sentences run
 * together without a seam. Level comes from an envelope computed off the
 * samples we already hold, walked against the context clock — cheaper and more
 * predictable than tapping the graph with an analyser every frame.
 */

// How often the level is refreshed while speaking. Matches the recorder's frame
// cadence so the orb behaves the same whoever is talking.
const ENVELOPE_HOP_MS = 64;

export interface SpeechPlayer {
  /** Queue a chunk. Playback starts on the first one. */
  enqueue: (samples: Float32Array) => void;
  /** Resolve once everything queued has finished playing. */
  drained: () => Promise<void>;
  /** Cut playback immediately and drop anything pending. */
  stop: () => Promise<void>;
}

// The context is expensive to build and safe to keep, but holding it open keeps
// the audio session live, so it is closed when a player is torn down.
let context: AudioContext | undefined;

function contextFor(sampleRate: number): AudioContext {
  if (context && context.sampleRate !== sampleRate) {
    void context.close();
    context = undefined;
  }
  if (!context) {
    context = new AudioContext({ sampleRate });
  }
  return context;
}

export function createSpeechPlayer(
  sampleRate: number,
  onLevel?: (level: number) => void,
): SpeechPlayer {
  const audioContext = contextFor(sampleRate);
  const queue = new AudioBufferQueueSourceNode(audioContext);
  queue.connect(audioContext.destination);

  let started = false;
  let pending = 0;
  let stopped = false;
  let envelopeTimer: ReturnType<typeof setInterval> | undefined;
  const waiters: (() => void)[] = [];

  // Envelope slices for everything queued so far, consumed in order by the
  // ticker below. Playback is gapless, so one continuous track works.
  let envelope: number[] = [];
  let cursor = 0;

  const settle = () => {
    if (pending === 0) {
      waiters.splice(0).forEach(resolve => resolve());
    }
  };

  const stopTicking = () => {
    if (envelopeTimer !== undefined) {
      clearInterval(envelopeTimer);
      envelopeTimer = undefined;
    }
    onLevel?.(0);
  };

  const startTicking = () => {
    if (envelopeTimer !== undefined || !onLevel) {
      return;
    }
    envelopeTimer = setInterval(() => {
      if (cursor >= envelope.length) {
        onLevel(0);
        return;
      }
      onLevel(envelope[cursor]);
      cursor += 1;
    }, ENVELOPE_HOP_MS);
  };

  queue.onBufferEnded = () => {
    pending = Math.max(0, pending - 1);
    if (pending === 0) {
      stopTicking();
      settle();
    }
  };

  return {
    enqueue: (samples: Float32Array) => {
      if (stopped || !samples.length) {
        return;
      }

      const buffer = audioContext.createBuffer(1, samples.length, sampleRate);
      // copyToChannel wants a Float32Array backed by its own ArrayBuffer, so
      // never hand it a subarray view of a pooled buffer.
      buffer.copyToChannel(Float32Array.from(samples), 0);
      queue.enqueueBuffer(buffer);
      pending += 1;

      envelope = envelope.concat(
        Array.from(envelopeOf(samples, sampleRate, ENVELOPE_HOP_MS)).map(
          value => normalizeLevel(value),
        ),
      );

      if (!started) {
        started = true;
        // Both arguments are explicit because AudioBufferQueueSourceNode
        // defaults `offset` to -1 and then rejects it in its own guard, so the
        // no-argument call throws "offset must be a finite non-negative
        // number: -1" every time. (react-native-audio-api 0.13.3)
        queue.start(0, 0);
      }
      startTicking();
    },

    drained: () =>
      new Promise<void>(resolve => {
        if (pending === 0) {
          resolve();
          return;
        }
        waiters.push(resolve);
      }),

    stop: async () => {
      if (stopped) {
        return;
      }
      stopped = true;
      stopTicking();
      try {
        queue.stop();
        queue.clearBuffers();
        queue.disconnect();
      } catch {
        // Already stopped, or never started. Nothing left to tear down.
      }
      pending = 0;
      settle();
      envelope = [];
      cursor = 0;
    },
  };
}

/** Release the shared audio context. Safe to call when none is open. */
export async function closePlayback(): Promise<void> {
  if (!context) {
    return;
  }
  const current = context;
  context = undefined;
  try {
    await current.close();
  } catch {
    // Closing twice is not an error worth surfacing.
  }
}
