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
  canKeepBothLoaded,
  describeError,
  ensureTtsLoaded,
  NoAudioError,
  releaseTts,
  synthesize,
  TTS_SAMPLE_RATE,
} from '@/core/llama';
import useModelStore from '@/features/models/store';
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

/**
 * What the model is told while the conversation is spoken aloud.
 *
 * Synthesis time is very nearly linear in characters — the voice reads at
 * roughly 15 a second and generates far slower than it speaks — so the length
 * of the reply is the single biggest lever on how long the user waits. A
 * paragraph that is pleasant to read is a minute of talking.
 */
const VOICE_SYSTEM_PROMPT =
  'You are in a spoken conversation. Reply in one or two short sentences, ' +
  'under 40 words. Speak plainly, as a person would out loud: no lists, no ' +
  'headings, no code, no emoji. If the answer is genuinely long, give the ' +
  'short version and offer to go deeper.';

/** The conversation's own prompt, put back when the call ends. */
let previousSystemPrompt: string | undefined;
let overrodeSystemPrompt = false;

function phase(next: VoicePhase) {
  set({ phase: next });
}

/**
 * Point the conversation at the voice prompt for the duration of the call.
 *
 * Set before the first message rather than after, because `sendMessage` starts
 * generation synchronously and `generateReply` reads the prompt as it goes.
 */
function applyVoicePrompt(id: string) {
  const chat = useChatStore.getState();
  previousSystemPrompt = chat.conversations[id]?.systemPrompt;
  overrodeSystemPrompt = true;
  chat.setConversationSystemPrompt(id, VOICE_SYSTEM_PROMPT);
}

function restoreSystemPrompt() {
  if (!overrodeSystemPrompt || !conversationId) {
    return;
  }
  overrodeSystemPrompt = false;
  useChatStore
    .getState()
    .setConversationSystemPrompt(conversationId, previousSystemPrompt);
  previousSystemPrompt = undefined;
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

    // With both models resident the voice can start a sentence into the reply
    // instead of after it, which is most of the difference between a
    // conversation and a wait. Decided per turn because the chat model can
    // change between them.
    const chatBytes =
      useModelStore.getState().getSelectedModel()?.sizeBytes ?? 0;
    const streaming = await canKeepBothLoaded(chatBytes);

    const reply = streaming
      ? await streamAndSpeak(heard)
      : await sendAndCollect(heard);

    if (!running) {
      return;
    }

    if (!streaming && reply.trim()) {
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

    // A conversation has to exist before its prompt can be set, and the prompt
    // has to be set before the first message starts generating.
    const targetId = conversationId ?? chat.createConversation();
    conversationId = targetId;
    if (!overrodeSystemPrompt) {
      applyVoicePrompt(targetId);
    }

    chat.sendMessage(targetId, text);

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

/**
 * Send, then speak each sentence as it arrives rather than waiting for the end.
 *
 * Only valid while both models are resident: synthesising mid-reply means the
 * chat model must still be loaded to finish it. The first sentence typically
 * lands seconds before the last, which is where the perceived speed comes from.
 *
 * @returns the full reply text, once spoken.
 */
async function streamAndSpeak(text: string): Promise<string> {
  const assets = resolveTtsAssets();
  if (!assets) {
    set({
      phase: 'error',
      error: 'No voice model is installed, so replies stay on screen.',
    });
    return '';
  }

  phase('preparing');
  await ensureTtsLoaded(assets.tts, assets.vocoder, { evictChat: false });
  if (!running) {
    return '';
  }

  ttsAbort = new AbortController();
  const { signal } = ttsAbort;
  player = createSpeechPlayer(TTS_SAMPLE_RATE, level => {
    if (running) {
      set({ level });
    }
  });

  // One worker drains the queue in order. Synthesis is single-threaded through
  // one context, so running sentences concurrently would only interleave them.
  const queue: string[] = [];
  let draining: Promise<void> = Promise.resolve();
  let spoke = false;
  let buffered = '';
  let speaking = false;

  const drain = async () => {
    while (queue.length && !signal.aborted && running) {
      const sentence = queue.shift() as string;
      try {
        const samples = await synthesize(sentence, signal);
        if (samples) {
          if (!speaking) {
            speaking = true;
            phase('speaking');
          }
          player?.enqueue(samples);
          spoke = true;
        }
      } catch (error) {
        if (error instanceof NoAudioError) {
          if (__DEV__) {
            console.warn('[voice] no audio for a sentence', {
              sentence: sentence.slice(0, 80),
              ...error.detail,
            });
          }
          continue;
        }
        throw error;
      }
    }
  };

  const push = (chunk: string, flush: boolean) => {
    buffered += chunk;
    const { sentences, rest } = drainSentences(buffered, flush);
    buffered = rest;
    if (!sentences.length) {
      return;
    }
    queue.push(...sentences);
    draining = draining.then(drain);
  };

  const reply = await sendStreaming(text, delta =>
    push(sanitizeForSpeech(delta), false),
  );

  // Whatever is left after the model stops, including a final unterminated
  // fragment.
  push('', true);
  await draining;

  if (!signal.aborted && running) {
    await player.drained();
  }

  await player.stop();
  player = undefined;
  ttsAbort = undefined;
  set({ level: 0 });

  if (!spoke && !signal.aborted && running && reply.trim()) {
    throw new Error(
      'The voice model ran but produced no sound. Check the logs for [voice].',
    );
  }

  return reply;
}

/**
 * Send and report the reply as it grows.
 *
 * `onDelta` receives only what is new, so the caller can chunk it into
 * sentences without re-scanning the whole reply each time.
 */
function sendStreaming(
  text: string,
  onDelta: (delta: string) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const chat = useChatStore.getState();
    const targetId = conversationId ?? chat.createConversation();
    conversationId = targetId;
    if (!overrodeSystemPrompt) {
      applyVoicePrompt(targetId);
    }

    chat.sendMessage(targetId, text);

    const ids =
      useChatStore.getState().conversations[targetId]?.messageIds ?? [];
    const replyId = ids[ids.length - 1];
    if (!replyId) {
      reject(new Error('The reply could not be started.'));
      return;
    }

    let seen = 0;
    const unsubscribe = useChatStore.subscribe(state => {
      const message = state.messages[replyId];
      if (!message) {
        return;
      }
      set({ reply: message.content });

      if (message.content.length > seen) {
        const delta = message.content.slice(seen);
        seen = message.content.length;
        onDelta(delta);
      }

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
    // Voice output is not installed. Say so rather than falling silent — a
    // conversation that answers only in text, with no explanation, reads as
    // broken.
    set({
      phase: 'error',
      error: 'No voice model is installed, so replies stay on screen.',
    });
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
  let spoke = false;

  for (const sentence of sentences) {
    if (signal.aborted || !running) {
      break;
    }
    try {
      const samples = await synthesize(sentence, signal);
      if (samples) {
        player.enqueue(samples);
        spoke = true;
      }
    } catch (error) {
      if (error instanceof NoAudioError) {
        // One sentence failing is worth knowing about but not worth abandoning
        // the turn over; the check after the loop reports a total failure.
        if (__DEV__) {
          console.warn('[voice] no audio for a sentence', {
            sentence: sentence.slice(0, 80),
            ...error.detail,
          });
        }
        continue;
      }
      throw error;
    }
  }

  if (!spoke && !signal.aborted && running) {
    throw new Error(
      'The voice model ran but produced no sound. Check the logs for [voice].',
    );
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

  restoreSystemPrompt();

  await releaseTts();
  await releaseSpeech();
  await deactivateSession();

  conversationId = undefined;
  useVoiceState.setState(initialState);
}

/**
 * Speak one fixed sentence, bypassing the microphone and the chat model.
 *
 * Development only. Time-to-first-sample and the realtime factor are the two
 * numbers that decide whether on-device TTS is viable at all, and they are
 * impossible to read off a full conversation where whisper and the chat model
 * dominate the wait.
 */
export async function testSpeak(
  sentence = 'Hello. This is a test of the on-device voice.',
) {
  const assets = resolveTtsAssets();
  if (!assets) {
    set({ phase: 'error', error: 'No voice model is installed.' });
    return;
  }

  // Take the live loop offline first. Listening continues in the background
  // otherwise, and a VAD-triggered turn will race this for the TTS context —
  // one side releases it while the other is mid-completion and the JSI call
  // fails with "Context not found".
  running = false;
  turnInFlight = true;
  await stopListening();

  set({ heard: sentence, reply: '', error: undefined });
  phase('preparing');

  const startedAt = Date.now();
  try {
    await ensureTtsLoaded(assets.tts, assets.vocoder);
    const loadedAt = Date.now();

    player = createSpeechPlayer(TTS_SAMPLE_RATE, level => set({ level }));
    phase('speaking');

    const samples = await synthesize(sentence);
    const synthesisedAt = Date.now();

    if (!samples) {
      throw new Error('Synthesis returned nothing.');
    }

    const audioSeconds = samples.length / TTS_SAMPLE_RATE;
    const computeSeconds = (synthesisedAt - loadedAt) / 1000;
    console.warn('[voice] test synthesis', {
      loadMs: loadedAt - startedAt,
      synthesisMs: synthesisedAt - loadedAt,
      audioSeconds: audioSeconds.toFixed(2),
      // Above 1.0 means the model cannot keep up with its own speech.
      realtimeFactor: (computeSeconds / audioSeconds).toFixed(2),
      samples: samples.length,
    });

    player.enqueue(samples);
    await player.drained();
    await player.stop();
    player = undefined;
    phase('idle');
  } catch (error) {
    const detail =
      error instanceof NoAudioError ? JSON.stringify(error.detail) : '';
    console.warn('[voice] test synthesis failed', describeError(error), detail);
    set({ phase: 'error', error: `${describeError(error)} ${detail}`.trim() });
  } finally {
    turnInFlight = false;
  }
}

/** Which conversation the call is writing into, for the screen to link back. */
export function activeVoiceConversation(): string | undefined {
  return conversationId;
}
