import { AudioRecorder } from 'react-native-audio-api';

import {
  int16BytesFromFloat32,
  mixToMono,
  normalizeLevel,
  resampleTo,
  rmsOf,
  WHISPER_SAMPLE_RATE,
} from './pcm';

/**
 * Microphone capture, normalised to what speech recognition needs: mono,
 * 16 kHz, signed 16-bit. The device decides what it actually hands over, so
 * every frame is folded and resampled here rather than hopefully requested.
 */

// ~64 ms per callback at 16 kHz. Short enough that the orb tracks speech and
// the VAD reacts promptly; long enough not to spend the frame budget in JSI.
const BUFFER_LENGTH = 1024;

export interface RecorderFrame {
  /** Mono samples at {@link WHISPER_SAMPLE_RATE}. */
  samples: Float32Array;
  /** The same samples as little-endian int16 bytes, ready for whisper. */
  bytes: Uint8Array;
  /** Smoothed 0..1 loudness, for driving the orb. */
  level: number;
}

export interface RecorderHandle {
  stop: () => Promise<void>;
  isRecording: () => boolean;
}

// One recorder for the whole app. Dictation and a voice call must never hold
// the microphone at the same time, and a shared instance makes that structural
// rather than something each caller has to remember.
let recorder: AudioRecorder | undefined;
let active = false;

function instance(): AudioRecorder {
  if (!recorder) {
    recorder = new AudioRecorder();
  }
  return recorder;
}

/**
 * Start delivering microphone frames.
 *
 * Assumes the microphone permission has already been granted — call
 * `ensureMicPermission` from `./session` first.
 *
 * @throws if capture is already running, or the platform refuses to start.
 */
export async function startRecording(
  onFrame: (frame: RecorderFrame) => void,
  onError?: (message: string) => void,
): Promise<RecorderHandle> {
  if (active) {
    throw new Error('The microphone is already in use.');
  }

  const audioRecorder = instance();

  audioRecorder.onError(event => onError?.(event.message));

  const registered = audioRecorder.onAudioReady(
    {
      sampleRate: WHISPER_SAMPLE_RATE,
      bufferLength: BUFFER_LENGTH,
      channelCount: 1,
    },
    event => {
      const { buffer } = event;
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
        buffer.getChannelData(i),
      );
      // The requested format is a preference, not a contract — fold and
      // resample against what actually arrived.
      const mono = mixToMono(channels);
      const samples = resampleTo(mono, buffer.sampleRate, WHISPER_SAMPLE_RATE);

      onFrame({
        samples,
        bytes: int16BytesFromFloat32(samples),
        level: normalizeLevel(rmsOf(samples)),
      });
    },
  );

  if (registered.status === 'error') {
    throw new Error(registered.message);
  }

  const started = await audioRecorder.start();
  if (started.status === 'error') {
    audioRecorder.clearOnAudioReady();
    audioRecorder.clearOnError();
    throw new Error(started.message);
  }

  active = true;

  return {
    isRecording: () => active,
    stop: async () => {
      if (!active) {
        return;
      }
      active = false;
      // Detach the callbacks before stopping so a frame already in flight
      // cannot land on a listener whose caller has already torn down.
      audioRecorder.clearOnAudioReady();
      audioRecorder.clearOnError();
      await audioRecorder.stop();
    },
  };
}

/** Whether the microphone is currently open. */
export function isRecording(): boolean {
  return active;
}
