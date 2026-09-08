import { create } from 'zustand';

import {
  activateSession,
  configureVoiceSession,
  createSpeechPlayer,
  deactivateSession,
  ensureMicPermission,
  type SpeechPlayer,
} from '@/core/audio';
import {
  describeError,
  ensureTtsLoaded,
  releaseTts,
  synthesize,
  TTS_SAMPLE_RATE,
} from '@/core/llama';
import useChatStore from '@/features/chat/store';
import { drainSentences, sanitizeForSpeech } from './chunker';
import type { VoicePhase } from './components/voice-orb';
import {
  releaseSpeech,
  startTranscribing,
  type TranscriberHandle,
} from './speech/transcriber';
import { resolveSpeechAsset, resolveTtsAssets, resolveVadAsset } from './store';

/**
 * The spoken turn loop.
 *
 * A module singleton rather than a hook, for the same reason the chat store
 * keeps `activeStreams` at module scope: it has to outlive re-renders and be
 * cancellable from anywhere, including a back gesture.
 *
 *   listen -> transcript -> send -> watch reply -> swap in the voice ->
 *   speak -> swap back -> listen
 *
 * Sending goes through the ordinary chat pipeline, so a spoken conversation
 * writes exactly the rows typing would: it shows up in the transcript, gets a
 * title, and `stopStreaming` already means the right thing.
 */

interface VoiceState {
  phase: VoicePhase;
  /** 0..1 loudness of whoever is talking, for the orb. */
  level: number;
  /** What the user last said. */
  heard: string;
  /** What the assistant is saying. */
  reply: string;
  error?: string;
  muted: boolean;
}

const initialState: VoiceState = {
  phase: 'idle',
  level: 0,
  heard: '',
  reply: '',
  error: undefined,
  muted: false,
};

export const useVoiceState = create<VoiceState>()(() => initialState);

const set = (patch: Partial<VoiceState>) =>
  useVoiceState.setState(patch as VoiceState);

let transcriber: TranscriberHandle | undefined;
let player: SpeechPlayer | undefined;
let ttsAbort: AbortController | undefined;
let conversationId: string | undefined;
let running = false;
// Guards the window between "the user stopped talking" and the reply being
// spoken, so a stray VAD event cannot start a second turn on top of the first.
let turnInFlight = false;

function phase(next: VoicePhase) {
  set({ phase: next });
}

/** Start a spoken conversation. Assumes the models are installed. */
export async function startVoice(existingConversationId?: string) {
  if (running) {
    return;
  }
  running = true;
  conversationId = existingConversationId;
  useVoiceState.setState({ ...initialState, phase: 'preparing' });

  try {
    if ((await ensureMicPermission()) !== 'Granted') {
      running = false;
      set({ phase: 'error', error: 'Microphone access is off.' });
      return;
    }
    configureVoiceSession();
    await activateSession();
    await listen();
  } catch (error) {
    running = false;
    set({ phase: 'error', error: describeError(error) });
  }
}

async function listen() {
  if (!running) {
    return;
  }

  const speech = resolveSpeechAsset();
  if (!speech) {
    set({ phase: 'error', error: 'No speech model is installed.' });
    return;
  }

  set({ heard: '', reply: '', error: undefined });
  phase('listening');

  transcriber = await startTranscribing({
    speech,
    vad: resolveVadAsset(),
    onText: text => set({ heard: text }),
    onLevel: level => {
      if (!useVoiceState.getState().muted) {
        set({ level });
      }
    },
    onActivity: event => {
      // The detector saying the turn ended is the cue to answer. Without it
      // there is no way to know, so the user has to tap instead.
      if (event === 'speech_end') {
        void finishTurn();
      }
    },
    onError: message => set({ phase: 'error', error: message }),
  });
}

async function stopListening() {
  const current = transcriber;
  transcriber = undefined;
  await current?.stop();
  set({ level: 0 });
}

/** Send what was heard and speak the answer. Safe to call more than once. */
export async function finishTurn() {
  if (!running || turnInFlight) {
    return;
  }
  const heard = useVoiceState.getState().heard.trim();
  if (!heard) {
    return;
  }

  turnInFlight = true;
  try {
    await stopListening();
    phase('thinking');

    const reply = await sendAndCollect(heard);
    if (!running) {
      return;
    }

    if (reply.trim()) {
      await speak(reply);
    }
  } catch (error) {
    if (running) {
      set({ phase: 'error', error: describeError(error) });
    }
  } finally {
    turnInFlight = false;
  }

  if (running) {
    await listen();
  }
}

/**
 * Send through the ordinary chat pipeline and wait for the whole reply.
 *
 * The reply is collected in full rather than spoken sentence by sentence
 * because speaking means swapping the chat model out for the voice — doing that
 * per sentence would mean two model loads per sentence.
 */
function sendAndCollect(text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const chat = useChatStore.getState();
    const targetId = chat.sendMessage(conversationId, text);
    conversationId = targetId;

    // sendMessage's set() is synchronous, so the placeholder already exists.
    const ids =
      useChatStore.getState().conversations[targetId]?.messageIds ?? [];
    const replyId = ids[ids.length - 1];
    if (!replyId) {
      reject(new Error('The reply could not be started.'));
      return;
    }

    const unsubscribe = useChatStore.subscribe(state => {
      const message = state.messages[replyId];
      if (!message) {
        return;
      }
      set({ reply: message.content });

      if (message.status === 'streaming') {
        return;
      }
      unsubscribe();
      if (message.status === 'error') {
        reject(new Error(message.error ?? 'The model could not answer.'));
        return;
      }
      resolve(message.content);
    });
  });
}

async function speak(reply: string) {
  const assets = resolveTtsAssets();
  if (!assets) {
    // Voice output is not installed; the reply is still on screen and in the
    // chat, so carry on listening rather than treating this as a failure.
    return;
  }

  phase('preparing');
  await ensureTtsLoaded(assets.tts, assets.vocoder);
  if (!running) {
    return;
  }

  ttsAbort = new AbortController();
  const { signal } = ttsAbort;

  player = createSpeechPlayer(TTS_SAMPLE_RATE, level => {
    if (running) {
      set({ level });
    }
  });

  phase('speaking');

  const { sentences } = drainSentences(sanitizeForSpeech(reply), true);
  for (const sentence of sentences) {
    if (signal.aborted || !running) {
      break;
    }
    const samples = await synthesize(sentence, signal);
    if (samples) {
      player.enqueue(samples);
    }
  }

  if (!signal.aborted && running) {
    await player.drained();
  }

  await player.stop();
  player = undefined;
  ttsAbort = undefined;
  set({ level: 0 });

  // Hand the memory back before the next turn needs the chat model again.
  await releaseTts();
}

/** Cut the assistant off and go back to listening. */
export async function interrupt() {
  ttsAbort?.abort();
  await player?.stop();
  player = undefined;

  if (conversationId) {
    // Reuses the existing stop path, which persists the partial reply exactly
    // as the composer's stop button does.
    useChatStore.getState().stopStreaming(conversationId);
  }

  set({ level: 0 });
  if (running && !turnInFlight) {
    await listen();
  }
}

export function setMuted(muted: boolean) {
  set({ muted, ...(muted ? { level: 0 } : null) });
}

/** End the conversation and give the microphone and speaker back. */
export async function stopVoice() {
  running = false;
  turnInFlight = false;

  ttsAbort?.abort();
  ttsAbort = undefined;

  await player?.stop();
  player = undefined;

  await stopListening();

  if (conversationId) {
    useChatStore.getState().stopStreaming(conversationId);
  }

  await releaseTts();
  await releaseSpeech();
  await deactivateSession();

  conversationId = undefined;
  useVoiceState.setState(initialState);
}

/** Which conversation the call is writing into, for the screen to link back. */
export function activeVoiceConversation(): string | undefined {
  return conversationId;
}
