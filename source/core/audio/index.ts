/**
 * Device audio: the microphone and the speaker. Adapters over the platform,
 * with no feature state and no UI — the same shape as `core/llama`.
 */
export {
  envelopeOf,
  float32FromInt16Bytes,
  int16BytesFromFloat32,
  mixToMono,
  normalizeLevel,
  resampleTo,
  rmsOf,
  WHISPER_SAMPLE_RATE,
} from './pcm';

export {
  activateSession,
  configureDictationSession,
  configureVoiceSession,
  deactivateSession,
  ensureMicPermission,
  explainMicDenied,
  type PermissionStatus,
} from './session';

export {
  isRecording,
  startRecording,
  type RecorderFrame,
  type RecorderHandle,
} from './recorder';

export { closePlayback, createSpeechPlayer, type SpeechPlayer } from './player';
