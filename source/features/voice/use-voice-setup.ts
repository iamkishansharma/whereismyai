import { createRef } from 'react';
import { create } from 'zustand';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

/**
 * The setup sheet is mounted once by the chat screen but opened from the
 * composer's microphone and waveform buttons, so the handle lives here rather
 * than in a ref one of them owns.
 *
 * Presenting stays imperative for the same reason the model picker's does:
 * mirroring open/closed into a store and calling present from an effect fires a
 * dismiss on mount and leaves the modal stack out of step. Only the reason it
 * was opened is state, because the sheet has to re-render when it changes.
 */
export const voiceSetupSheetRef = createRef<BottomSheetModal>();

/** Which button asked for setup — the two need different explanations. */
export type VoiceIntent = 'dictation' | 'conversation';

interface VoiceSetupStore {
  intent: VoiceIntent;
  setIntent: (intent: VoiceIntent) => void;
}

export const useVoiceSetupStore = create<VoiceSetupStore>()(set => ({
  intent: 'dictation',
  setIntent: intent => set({ intent }),
}));

export function openVoiceSetup(intent: VoiceIntent): void {
  useVoiceSetupStore.getState().setIntent(intent);
  voiceSetupSheetRef.current?.present();
}

export function closeVoiceSetup(): void {
  voiceSetupSheetRef.current?.dismiss();
}
