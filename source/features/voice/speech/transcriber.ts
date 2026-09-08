import { initWhisper, initWhisperVad } from 'whisper.rn';
import {
  RealtimeTranscriber,
  RingBufferVad,
  type RealtimeTranscribeEvent,
  type RealtimeVadEvent,
} from 'whisper.rn/realtime-transcription/index';

import { WHISPER_SAMPLE_RATE } from '@/core/audio';
import type { InstalledVoiceAsset } from '@/types';
import { createAudioStream } from './audio-stream-adapter';

/**
 * The only place whisper.rn is called.
 *
 * Its README documents an API its own 0.7.4 types disagree with, so keeping
 * every call behind this file means a version bump is one file to reconcile
 * rather than a hunt through the feature.
 */

// A slice is the window whisper re-transcribes as more audio arrives. Long
// enough to keep sentence context, short enough that the composer keeps up.
const SLICE_SECONDS = 30;

export type VoiceActivity = 'speech_start' | 'speech_end';

export interface TranscriberOptions {
  speech: InstalledVoiceAsset;
  /** Silero. Without it there is no turn detection, only continuous slices. */
  vad?: InstalledVoiceAsset;
  /** Whole transcript so far, rebuilt whenever any slice changes. */
  onText: (text: string) => void;
  onActivity?: (event: VoiceActivity, detail: RealtimeVadEvent) => void;
  onLevel?: (level: number) => void;
  onError?: (message: string) => void;
}

export interface TranscriberHandle {
  stop: () => Promise<void>;
  /** Forget the transcript so the next turn starts clean. */
  reset: () => void;
}

// Loading a whisper model takes real time, so contexts outlive a single
// dictation and are only torn down when the file changes or voice is done.
let whisperContext: Awaited<ReturnType<typeof initWhisper>> | undefined;
let whisperPath: string | undefined;
let vadContext: Awaited<ReturnType<typeof initWhisperVad>> | undefined;
let vadPath: string | undefined;

async function contextFor(speech: InstalledVoiceAsset) {
  if (whisperContext && whisperPath === speech.path) {
    return whisperContext;
  }
  await whisperContext?.release();
  // `useGpu` is iOS-only in whisper.rn and Core ML assets are not bundled, so
  // this stays on the CPU path everywhere — predictable, and these models are
  // small enough that it is not the bottleneck.
  whisperContext = await initWhisper({ filePath: speech.path });
  whisperPath = speech.path;
  return whisperContext;
}

async function vadFor(vad: InstalledVoiceAsset) {
  if (vadContext && vadPath === vad.path) {
    return vadContext;
  }
  await vadContext?.release();
  vadContext = await initWhisperVad({ filePath: vad.path });
  vadPath = vad.path;
  return vadContext;
}

/** Drop both contexts. Call when leaving voice for good. */
export async function releaseSpeech(): Promise<void> {
  await whisperContext?.release();
  await vadContext?.release();
  whisperContext = undefined;
  vadContext = undefined;
  whisperPath = undefined;
  vadPath = undefined;
}

export async function startTranscribing({
  speech,
  vad,
  onText,
  onActivity,
  onLevel,
  onError,
}: TranscriberOptions): Promise<TranscriberHandle> {
  const whisper = await contextFor(speech);
  const audioStream = createAudioStream(onLevel);

  // Slices are re-transcribed as they grow, so the latest text for each index
  // replaces the previous one. Joining them in index order is the transcript.
  const slices = new Map<number, string>();
  const rebuild = () =>
    [...slices.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, text]) => text.trim())
      .filter(Boolean)
      .join(' ');

  const transcriber = new RealtimeTranscriber(
    {
      whisperContext: whisper,
      audioStream,
      // RingBufferVad, not the raw context — RealtimeTranscriber wants the
      // ring-buffer wrapper, which is the part the README gets wrong.
      ...(vad
        ? {
            vadContext: new RingBufferVad(await vadFor(vad), {
              vadPreset: 'default',
              sampleRate: WHISPER_SAMPLE_RATE,
            }),
          }
        : null),
    },
    {
      audioSliceSec: SLICE_SECONDS,
      audioStreamConfig: {
        sampleRate: WHISPER_SAMPLE_RATE,
        channels: 1,
        bitsPerSample: 16,
      },
    },
    {
      onTranscribe: (event: RealtimeTranscribeEvent) => {
        const text = event.data?.result;
        if (typeof text !== 'string') {
          return;
        }
        slices.set(event.sliceIndex, text);
        onText(rebuild());
      },
      onVad: (event: RealtimeVadEvent) => {
        if (event.type === 'speech_start' || event.type === 'speech_end') {
          onActivity?.(event.type, event);
        }
      },
      onError: message => onError?.(message),
    },
  );

  await transcriber.start();

  return {
    stop: async () => {
      await transcriber.stop();
      await audioStream.release();
    },
    reset: () => slices.clear(),
  };
}
