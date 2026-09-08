import { initLlama, type LlamaContext } from 'llama.rn';

import type { InstalledVoiceAsset } from '@/types';
import { describeError, unload } from './engine';

/**
 * Text to speech through llama.rn's vocoder API.
 *
 * OuteTTS generates audio tokens like any other completion; WavTokenizer turns
 * them into samples. Both live in one `LlamaContext` that is separate from the
 * chat one — and, by design, never resident at the same time. A phone that can
 * comfortably hold a chat model plus a 500M voice model plus a vocoder is not
 * the phone this has to work on, so speaking swaps the chat model out and back.
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

let context: LlamaContext | undefined;
let loadedPath: string | undefined;

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
  onProgress?: (progress: number) => void,
): Promise<LlamaContext> {
  if (context && loadedPath === tts.path) {
    return context;
  }

  await releaseTts();
  // One llama context at a time. Loading the voice while the chat model is
  // still resident is what makes mid-range devices get killed.
  await unload();

  try {
    const next = await initLlama(
      {
        model: tts.path,
        // OuteTTS prepends a speaker prompt of around a thousand tokens before
        // anything we ask for, so a small window is not an option.
        n_ctx: 4096,
        n_batch: 512,
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

  if (signal?.aborted) {
    return undefined;
  }

  const onAbort = () => {
    void ctx.stopCompletion();
  };
  signal?.addEventListener('abort', onAbort);

  try {
    const result = await ctx.completion({
      // A raw prompt, not `messages` — this must skip chat templating entirely.
      prompt,
      grammar,
      guide_tokens: guideTokens,
      n_predict: tokenBudgetFor(text),
      temperature: 0.7,
      top_k: 40,
      top_p: 0.95,
      penalty_repeat: 1.1,
    });

    if (signal?.aborted) {
      return undefined;
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
