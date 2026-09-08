/**
 * Voice: dictation into the composer, and spoken conversation.
 *
 * Deliberately imported by path from other features rather than through this
 * barrel where a cycle is possible — the same rule the chat and model barrels
 * carry.
 */
export { default as useVoiceStore, useCanDictate, useCanSpeak } from './store';
export { useDictation, type Dictation } from './use-dictation';
export { default as DictationPill } from './components/dictation-pill';
export { default as VoiceModelRow } from './components/voice-model-row';
export {
  ALL_VOICE_ASSETS,
  DEFAULT_SPEECH_ASSET,
  SPEECH_CATALOG,
  TTS_ASSET,
  VAD_ASSET,
  VOCODER_ASSET,
  VOICE_OUTPUT_ASSETS,
  voiceAssetById,
} from './catalog';
