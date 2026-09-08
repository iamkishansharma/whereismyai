import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import useModelStore from '@/features/models/store';
import type { InstalledVoiceAsset } from '@/types';
import {
  DEFAULT_SPEECH_ASSET,
  TTS_ASSET,
  VAD_ASSET,
  VOCODER_ASSET,
} from './catalog';

/**
 * Which voice files the user has chosen, and whether the assistant speaks.
 *
 * Only preferences live here. What is actually installed stays in the model
 * store beside every other download, so there is one place that knows what is
 * on disk.
 */

interface VoiceStore {
  /** Which whisper model to transcribe with. */
  speechAssetId: string;
  setSpeechAssetId: (assetId: string) => void;
  /** Whether replies are spoken aloud in a voice conversation. */
  speakReplies: boolean;
  setSpeakReplies: (speak: boolean) => void;
}

const useVoiceStore = create<VoiceStore>()(
  persist(
    set => ({
      speechAssetId: DEFAULT_SPEECH_ASSET.id,
      setSpeechAssetId: speechAssetId => set({ speechAssetId }),
      speakReplies: true,
      setSpeakReplies: speakReplies => set({ speakReplies }),
    }),
    {
      name: 'voice-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export default useVoiceStore;

/**
 * The speech model to use, if it is actually installed.
 *
 * Falls back to any other installed speech model rather than insisting on the
 * chosen one — a user who deleted their pick should still be able to dictate.
 */
export function resolveSpeechAsset(): InstalledVoiceAsset | undefined {
  const { voiceInstalled } = useModelStore.getState();
  const chosen = voiceInstalled[useVoiceStore.getState().speechAssetId];
  if (chosen) {
    return chosen;
  }
  return Object.values(voiceInstalled).find(asset => asset.role === 'speech');
}

export function resolveVadAsset(): InstalledVoiceAsset | undefined {
  return useModelStore.getState().voiceInstalled[VAD_ASSET.id];
}

export function resolveTtsAssets():
  | { tts: InstalledVoiceAsset; vocoder: InstalledVoiceAsset }
  | undefined {
  const { voiceInstalled } = useModelStore.getState();
  const tts = voiceInstalled[TTS_ASSET.id];
  const vocoder = voiceInstalled[VOCODER_ASSET.id];
  // Neither half is any use alone, so treat a partial install as absent.
  return tts && vocoder ? { tts, vocoder } : undefined;
}

/** Whether dictation can run at all. */
export const useCanDictate = () =>
  useModelStore(state =>
    Object.values(state.voiceInstalled).some(asset => asset.role === 'speech'),
  );

/** Whether the assistant has a voice installed. */
export const useCanSpeak = () =>
  useModelStore(
    state =>
      Boolean(state.voiceInstalled[TTS_ASSET.id]) &&
      Boolean(state.voiceInstalled[VOCODER_ASSET.id]),
  );
