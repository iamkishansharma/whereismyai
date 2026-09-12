import { getBackendDevicesInfo, initLlama, type LlamaContext } from 'llama.rn';

import type { InstalledVoiceAsset } from '@/types';
import { isIOS } from '@/shared/utils';
import { describeError, unload } from './engine';

/**
 * Text to speech through llama.rn's vocoder API.
 *
 * OuteTTS generates audio tokens like any other completion; WavTokenizer turns
 * them into samples. Both live in one `LlamaContext` separate from the chat
 * one.
 *
 * Whether they can be resident together decides how the conversation feels. If
 * they can, speech starts a sentence into the reply and the model never
 * reloads; if they cannot, the chat model is evicted first and the user waits
 * several seconds for the swap on every single turn. So we ask the device.
 */

/**
 * WavTokenizer-Large-**75** emits 75 codes per second and llama.rn's vocoder
 * hops 320 samples per code, so the output is 75 x 320 = 24 kHz. This is
 * derived from the model and the C++ rather than documented anywhere; if speech
 * ever comes out chipmunked or slurred, this constant is the first suspect.
 */
export const TTS_SAMPLE_RATE = 24000;

// Roughly sixteen seconds of audio at 75 codes/second — the ceiling, not the
// target. Reaching it means the model never emitted its stop token.
const MAX_AUDIO_TOKENS = 1200;

/**
 * How many audio tokens a piece of text should plausibly need.
 *
 * OuteTTS emits ~75 codes per second and English runs ~15 characters per
 * second, so a character costs about 5 tokens. Measured runs showed the model
 * happily generating to whatever ceiling it is given — 1200 tokens (16 seconds
 * of audio) for a 45-character sentence — so the budget is sized to the text
 * with headroom rather than left wide open. Synthesis time is proportional to
 * tokens generated, which makes this the single biggest lever on latency.
 */
function tokenBudgetFor(text: string): number {
  const estimated = Math.round(text.length * 5 * 1.6) + 150;
  return Math.min(MAX_AUDIO_TOKENS, Math.max(200, estimated));
}

/**
 * The vocoder's batch size, and the hard ceiling on one decode.
 *
 * `decodeAudioTokens` submits every audio token as a SINGLE `llama_encode`
 * batch, and llama.rn builds the vocoder with `n_ubatch = n_batch`. Exceeding
 * it does not fail gracefully — `llama_context::encode` calls `GGML_ABORT` and
 * takes the whole process down. This must therefore stay comfortably above
 * MAX_AUDIO_TOKENS. llama.cpp's own tts example uses 8192 for the same reason.
 */
const VOCODER_BATCH = 4096;

/**
 * Hardware tuning for speech generation. Zero means "leave it to llama.rn".
 *
 * Both were measured on the Android emulator and both made things dramatically
 * worse there: full GPU offload took the realtime factor from 6.1x to 38.3x
 * (the emulator has no GPU backend to offload to), and four threads was slower
 * than the default two (four emulated vCPUs, heavily contended). Neither
 * result predicts real silicon — a phone with Metal or Adreno should benefit
 * from both — so they are left off by default and kept here as named,
 * measurable knobs rather than removed. Use the Test voice button on a real
 * device before changing them.
 */
const TTS_GPU_LAYERS = 0;
const TTS_THREADS = 0;

/**
 * What OuteTTS plus its vocoder need resident, weights and working memory.
 *
 * The 500M model is ~350MB at Q4, the vocoder ~73MB, and the 4k context plus
 * compute buffers account for the rest.
 */
const TTS_RESIDENT_BYTES = 700 * 1024 * 1024;

/**
 * Share of device memory an app may reasonably hold in models.
 *
 * Deliberately well under half: iOS jetsams aggressively and the rest of the
 * app, the JS heap and the audio graph all have to live somewhere too.
 */
const MEMORY_BUDGET = isIOS ? 0.45 : 0.4;

let context: LlamaContext | undefined;
let loadedPath: string | undefined;
let deviceMemoryBytes: number | undefined;

async function totalDeviceMemory(): Promise<number> {
  if (deviceMemoryBytes !== undefined) {
    return deviceMemoryBytes;
  }
  try {
    const devices = await getBackendDevicesInfo();
    // The CPU backend reports system RAM, which is the number that matters —
    // a GPU entry describes a shared pool on every phone we run on.
    deviceMemoryBytes = devices.reduce(
      (largest, device) => Math.max(largest, device.maxMemorySize || 0),
      0,
    );
  } catch {
    deviceMemoryBytes = 0;
  }
  return deviceMemoryBytes;
}

/**
 * Whether the voice can load without evicting a chat model of this size.
 *
 * Answers false when the device will not say how much memory it has, because
 * guessing wrong here means the OS kills the app mid-sentence.
 */
export async function canKeepBothLoaded(chatBytes: number): Promise<boolean> {
  const total = await totalDeviceMemory();
  if (!total) {
    return false;
  }
  return chatBytes + TTS_RESIDENT_BYTES <= total * MEMORY_BUDGET;
}

export function isTtsLoaded(): boolean {
  return context !== undefined;
}

/**
 * Load OuteTTS and its vocoder, evicting the chat model first.
 *
 * @throws when either half fails to load, with a message worth showing.
 */
export async function ensureTtsLoaded(
  tts: InstalledVoiceAsset,
  vocoder: InstalledVoiceAsset,
  options: {
    evictChat?: boolean;
    onProgress?: (progress: number) => void;
  } = {},
): Promise<LlamaContext> {
  const { evictChat = true, onProgress } = options;

  if (context && loadedPath === tts.path) {
    return context;
  }

  await releaseTts();
  if (evictChat) {
    // Not enough memory for both. Loading the voice alongside the chat model
    // is what gets mid-range devices killed, so the chat model goes first and
    // is reloaded after the reply is spoken.
    await unload();
  }

  try {
    const next = await initLlama(
      {
        model: tts.path,
        // OuteTTS prepends a speaker prompt of around a thousand tokens before
        // anything we ask for, so a small window is not an option.
        n_ctx: 4096,
        n_batch: 512,
        ...(TTS_GPU_LAYERS > 0 ? { n_gpu_layers: TTS_GPU_LAYERS } : null),
        ...(TTS_THREADS > 0 ? { n_threads: TTS_THREADS } : null),
        // Never mlock the voice: it is the short-lived tenant, and pinning two
        // models is how the second allocation gets killed rather than paged.
        use_mlock: false,
        ctx_shift: false,
      },
      onProgress,
    );

    const enabled = await next.initVocoder({
      path: vocoder.path,
      n_batch: VOCODER_BATCH,
    });

    if (!enabled || !(await next.isVocoderEnabled())) {
      await next.release();
      throw new Error(
        'The voice decoder failed to load. Re-downloading the voice models may fix it.',
      );
    }

    context = next;
    loadedPath = tts.path;
    return next;
  } catch (error) {
    context = undefined;
    loadedPath = undefined;
    throw new Error(describeError(error));
  }
}

export async function releaseTts(): Promise<void> {
  const current = context;
  context = undefined;
  loadedPath = undefined;
  if (!current) {
    return;
  }
  try {
    await current.releaseVocoder();
  } catch {
    // Releasing a vocoder that never fully loaded is not worth reporting.
  }
  await current.release();
}

/**
 * Raised when the voice model ran but emitted nothing playable.
 *
 * Carries what the model actually did, because the failure is otherwise
 * indistinguishable from silence: the completion succeeds, `audio_tokens` is
 * simply absent, and every downstream step happily does nothing.
 */
export class NoAudioError extends Error {
  constructor(readonly detail: SynthesisDiagnostics) {
    super('The voice model produced no audio.');
    this.name = 'NoAudioError';
  }
}

export interface SynthesisDiagnostics {
  vocoderEnabled: boolean;
  /** Characters of the formatted prompt — the speaker block alone is ~1k tokens. */
  promptChars: number;
  grammarChars: number;
  guideTokenCount: number;
  /**
   * What the model emitted as text. The tell: real words here mean it
   * free-generated prose instead of audio codes, so the grammar is not binding.
   */
  textSample: string;
  contextFull?: boolean;
  truncated?: boolean;
}

/**
 * Which OuteTTS convention a formatted prompt was built with, and which one the
 * grammar demands.
 *
 * llama.rn builds the prompt per version — 0.2 separates words with
 * `<|text_sep|>` and wraps code runs in `<|code_start|>`/`<|code_end|>`, while
 * 0.3 uses `<|space|>` for both — but hands back the same OUTETTS_V2_GRAMMAR
 * for either. That grammar requires `<|space|>`. Applied to a 0.2 prompt it
 * forces the sampler to emit `<|space|>` exactly where the model was trained to
 * emit `<|code_end|>`, and everything after that point is off-distribution:
 * incoherent codes, which the vocoder renders as noise.
 *
 * Rather than trust a version string, read the prompt we were actually given.
 */
interface PromptShape {
  /** The convention the prompt itself uses. */
  promptConvention: 'v0.2' | 'v0.3' | 'unknown';
  /** Whether a grammar came back at all, and whether it wants `<|space|>`. */
  grammarChars: number;
  grammarWantsSpace: boolean;
  promptChars: number;
}

function describePromptShape(prompt: string, grammar?: string): PromptShape {
  const hasTextSep = prompt.includes('<|text_sep|>');
  const hasCodeEnd = prompt.includes('<|code_end|>');
  const hasSpace = prompt.includes('<|space|>');

  return {
    promptConvention:
      hasTextSep || hasCodeEnd ? 'v0.2' : hasSpace ? 'v0.3' : 'unknown',
    grammarChars: grammar?.length ?? 0,
    grammarWantsSpace: grammar?.includes('"<|space|>"') ?? false,
    promptChars: prompt.length,
  };
}

/**
 * Send the grammar only when it agrees with the prompt.
 *
 * The grammar's real job is forcing termination, so it is kept wherever it
 * matches. Where it contradicts the prompt, generating unconstrained is far
 * better than generating something the model cannot produce coherently.
 */
function shouldSendGrammar(shape: PromptShape): boolean {
  if (!shape.grammarChars) {
    return false;
  }
  return !(shape.grammarWantsSpace && shape.promptConvention === 'v0.2');
}

/**
 * Turn one piece of text into samples at {@link TTS_SAMPLE_RATE}.
 *
 * @throws {NoAudioError} when the model emitted no audio tokens. Deliberately
 * loud: an earlier version returned undefined here, which turned a broken
 * vocoder into a conversation that listened, thought, and then said nothing at
 * all with no error anywhere.
 */
export async function synthesize(
  text: string,
  signal?: AbortSignal,
): Promise<Float32Array | undefined> {
  const ctx = context;
  if (!ctx || !text.trim()) {
    return undefined;
  }

  // Each sentence is an independent prompt. Without this the previous
  // sentence's KV prefix leaks into the next one and the voice drifts.
  await ctx.clearCache();

  const { prompt, grammar } = await ctx.getFormattedAudioCompletion(null, text);
  // Guide tokens hold the model to the words we actually asked for; without
  // them OuteTTS will happily speak something adjacent.
  const guideTokens = await ctx.getAudioCompletionGuideTokens(text);

  const shape = describePromptShape(prompt, grammar);
  const useGrammar = shouldSendGrammar(shape);

  if (signal?.aborted) {
    return undefined;
  }

  const onAbort = () => {
    void ctx.stopCompletion();
  };
  signal?.addEventListener('abort', onAbort);

  try {
    const budget = tokenBudgetFor(text);
    const result = await ctx.completion({
      // A raw prompt, not `messages` — this must skip chat templating entirely.
      prompt,
      ...(useGrammar ? { grammar } : null),
      guide_tokens: guideTokens,
      n_predict: budget,
      temperature: 0.7,
      top_k: 40,
      top_p: 0.95,
      // No repeat penalty. These are audio codes, not words: the same code
      // recurring is normal, and penalising it bends the sequence away from
      // what the vocoder expects. llama.cpp's own tts example omits it too.
    });

    if (signal?.aborted) {
      return undefined;
    }

    if (__DEV__) {
      const audible = (result.audio_tokens ?? []).length;
      console.warn('[voice] synthesis', {
        ...shape,
        grammarSent: useGrammar,
        budget,
        audioTokens: audible,
        // Reaching the budget means the model never emitted <|audio_end|>,
        // which is the signature of generation having gone off-distribution.
        hitBudget: audible >= budget - 1,
        contextFull: result.context_full,
        text: (result.text ?? '').slice(0, 120),
      });
    }

    let tokens = result.audio_tokens ?? [];

    // Belt and braces: a batch larger than the vocoder's aborts the process
    // rather than returning an error, so never hand it more than it can take.
    if (tokens.length > VOCODER_BATCH) {
      tokens = tokens.slice(0, VOCODER_BATCH);
    }

    if (!tokens.length) {
      throw new NoAudioError({
        vocoderEnabled: await ctx.isVocoderEnabled(),
        promptChars: prompt.length,
        grammarChars: grammar?.length ?? 0,
        guideTokenCount: guideTokens.length,
        textSample: (result.text ?? '').slice(0, 200),
        contextFull: result.context_full,
        truncated: result.truncated,
      });
    }

    const samples = await ctx.decodeAudioTokens(tokens);
    if (!samples.length) {
      throw new NoAudioError({
        vocoderEnabled: await ctx.isVocoderEnabled(),
        promptChars: prompt.length,
        grammarChars: grammar?.length ?? 0,
        guideTokenCount: guideTokens.length,
        textSample: `decoded 0 samples from ${tokens.length} audio tokens`,
        contextFull: result.context_full,
        truncated: result.truncated,
      });
    }
    return Float32Array.from(samples);
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}
