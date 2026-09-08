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

// Roughly sixteen seconds of audio. Long enough for any sentence we send, and a
// bound on the damage if the model fails to emit a stop.
const MAX_AUDIO_TOKENS = 1200;

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
      n_batch: 512,
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
 * Turn one piece of text into samples at {@link TTS_SAMPLE_RATE}.
 *
 * Returns undefined when the model produced no audio tokens, which callers
 * should treat as "this sentence stays silent" rather than as a failure — the
 * conversation is more useful continuing without a voice than stopping.
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
      n_predict: MAX_AUDIO_TOKENS,
      temperature: 0.7,
      top_k: 40,
      top_p: 0.95,
      penalty_repeat: 1.1,
    });

    const tokens = result.audio_tokens ?? [];
    if (!tokens.length || signal?.aborted) {
      return undefined;
    }

    const samples = await ctx.decodeAudioTokens(tokens);
    return samples.length ? Float32Array.from(samples) : undefined;
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}
