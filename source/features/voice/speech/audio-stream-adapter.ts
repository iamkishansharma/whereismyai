// Imported with the explicit `/index`: whisper.rn's `exports` map sends the
// bare `whisper.rn/realtime-transcription` subpath to a file that does not
// exist, and neither Metro nor TypeScript can resolve it. The `/index` form
// matches the package's own `./*` pattern and resolves for both.
import type {
  AudioStreamConfig,
  AudioStreamData,
  AudioStreamInterface,
} from 'whisper.rn/realtime-transcription/index';

import {
  startRecording,
  WHISPER_SAMPLE_RATE,
  type RecorderHandle,
} from '@/core/audio';

/**
 * Bridges our microphone into whisper.rn.
 *
 * `RealtimeTranscriber` does not open the microphone itself — `audioStream` is
 * a required dependency and the only adapter it ships expects a package we do
 * not otherwise need. Feeding it from `core/audio` instead keeps one recorder
 * for the whole app, so dictation and a voice call can never both hold the mic.
 */
export interface LevelSink {
  (level: number): void;
}

export function createAudioStream(onLevel?: LevelSink): AudioStreamInterface {
  let handle: RecorderHandle | undefined;
  let dataCallback: ((data: AudioStreamData) => void) | undefined;
  let errorCallback: ((error: string) => void) | undefined;
  let statusCallback: ((isRecording: boolean) => void) | undefined;
  let endCallback: (() => void) | undefined;

  const notifyStatus = (isRecording: boolean) => statusCallback?.(isRecording);

  return {
    initialize: async (_config: AudioStreamConfig) => {
      // Nothing to configure: the recorder always normalises to the mono
      // 16 kHz signed-16-bit that whisper requires, whatever the device gives.
    },

    start: async () => {
      if (handle) {
        return;
      }
      handle = await startRecording(
        frame => {
          onLevel?.(frame.level);
          dataCallback?.({
            data: frame.bytes,
            sampleRate: WHISPER_SAMPLE_RATE,
            channels: 1,
            timestamp: Date.now(),
          });
        },
        message => errorCallback?.(message),
      );
      notifyStatus(true);
    },

    stop: async () => {
      if (!handle) {
        return;
      }
      const current = handle;
      handle = undefined;
      await current.stop();
      onLevel?.(0);
      notifyStatus(false);
      endCallback?.();
    },

    isRecording: () => handle?.isRecording() ?? false,

    onData: callback => {
      dataCallback = callback;
    },
    onError: callback => {
      errorCallback = callback;
    },
    onStatusChange: callback => {
      statusCallback = callback;
    },
    onEnd: callback => {
      endCallback = callback;
    },

    release: async () => {
      await handle?.stop();
      handle = undefined;
      dataCallback = undefined;
      errorCallback = undefined;
      statusCallback = undefined;
      endCallback = undefined;
    },
  };
}
