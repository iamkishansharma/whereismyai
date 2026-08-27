import {
  initLlama,
  loadLlamaModelInfo,
  type LlamaContext,
  type RNLlamaOAICompatibleMessage,
  type TokenData,
} from 'llama.rn';

import type { GenerationSettings, InstalledModel, ModelInfo } from '@/types';
import { IMAGE_TOKEN_COST, VISION_MIN_CTX } from './context-window';

const VISION_MAX_TOKENS = IMAGE_TOKEN_COST;

let context: LlamaContext | undefined;
let loadedModelId: string | undefined;
let loading: Promise<LlamaContext> | undefined;

// Whether the loaded context can actually see, as opposed to whether the model
// shipped a projector. Only known after initMultimodal has been asked.
let visionActive = false;
let visionError: string | undefined;

export function isVisionActive(): boolean {
  return visionActive;
}

export function getVisionError(): string | undefined {
  return visionError;
}

export async function unload(): Promise<void> {
  loading = undefined;
  loadedModelId = undefined;
  visionActive = false;
  visionError = undefined;
  const current = context;
  context = undefined;
  await current?.release();
}

export function ensureLoaded(
  model: InstalledModel,
  settings: GenerationSettings,
  onProgress?: (progress: number) => void,
): Promise<LlamaContext> {
  if (context && loadedModelId === model.id) {
    return Promise.resolve(context);
  }
  if (loading && loadedModelId === model.id) {
    return loading;
  }

  loadedModelId = model.id;
  loading = (async () => {
    const previous = context;
    context = undefined;
    await previous?.release();

    try {
      const isVisionModel = model.mmprojPath !== undefined;

      const next = await initLlama(
        {
          model: model.path,
          n_ctx: isVisionModel
            ? Math.max(settings.nCtx, VISION_MIN_CTX)
            : settings.nCtx,
          n_gpu_layers: settings.nGpuLayers,
          use_mlock: true,
          // Required for multimodal: context shifting moves tokens around and
          // breaks media token positioning. llama.rn documents this explicitly.
          ...(isVisionModel ? { ctx_shift: false } : null),
        },
        onProgress,
      );
      visionActive = false;
      visionError = undefined;

      if (model.mmprojPath) {
        // The projector runs on CPU. clip falls back to backend_cpu when GPU is
        // off, whereas asking for GPU on the iOS Simulator traps inside
        // MTLSimDriver while loading tensors. Projectors are ~100MB, so the CPU
        // cost is small and this is correct on every device.
        const enabled = await next.initMultimodal({
          path: model.mmprojPath,
          use_gpu: false,
          // Speed/detail dial for vision prefill; 256-512 stays responsive.
          image_max_tokens: VISION_MAX_TOKENS,
        });

        // initMultimodal returning false is not an error — it means the
        // projector never loaded, so images must not be sent as if it had.
        visionActive = enabled && (await next.getMultimodalSupport()).vision;
        if (!visionActive) {
          visionError =
            'The vision projector failed to load, so images cannot be read. ' +
            'Re-downloading the model may fix it.';
        }
      }

      context = next;
      return next;
    } catch (error) {
      loadedModelId = undefined;
      context = undefined;
      visionActive = false;
      throw error;
    } finally {
      loading = undefined;
    }
  })();

  return loading;
}

export interface CompletionHandle {
  cancel: () => void;
}

export interface CompletionOutcome {
  stopped: boolean;
  error?: string;
  /** The prompt filled the window, so nothing was generated. */
  contextFull?: boolean;
  /** llama.rn dropped tokens off the front of the prompt to make it fit. */
  truncated?: boolean;
}

export function runCompletion(
  ctx: LlamaContext,
  messages: RNLlamaOAICompatibleMessage[],
  settings: GenerationSettings,
  onToken: (token: string) => void,
  onDone: (outcome: CompletionOutcome) => void,
): CompletionHandle {
  let cancelled = false;

  ctx
    .completion(
      {
        messages,
        n_predict: settings.nPredict,
        temperature: settings.temperature,
        top_p: settings.topP,
        top_k: settings.topK,
        penalty_repeat: settings.repeatPenalty,
      },
      (data: TokenData) => {
        if (!cancelled) {
          onToken(data.token);
        }
      },
    )
    // llama.rn reports a full context by returning without generating at all,
    // so dropping this result turns overflow into a silent empty reply.
    .then(result =>
      onDone({
        stopped: cancelled,
        contextFull: result.context_full,
        truncated: result.truncated,
      }),
    )
    .catch((error: unknown) =>
      onDone({
        stopped: cancelled,
        error: cancelled ? undefined : describeError(error),
      }),
    );

  return {
    cancel: () => {
      cancelled = true;
      void ctx.stopCompletion();
    },
  };
}

/**
 * Exact prompt length, used to check the character-based estimate before
 * committing to it. Images are counted rather than encoded — tokenizing with
 * media_paths would run the projector just to arrive at a number we know.
 */
export async function measurePrompt(
  ctx: LlamaContext,
  messages: RNLlamaOAICompatibleMessage[],
): Promise<number> {
  const images = messages.reduce((total, message) => {
    if (!Array.isArray(message.content)) {
      return total;
    }
    return (
      total +
      message.content.filter(
        part => (part as { type?: string }).type === 'image_url',
      ).length
    );
  }, 0);

  const formatted = await ctx.getFormattedChat(messages);
  const { tokens } = await ctx.tokenize(formatted.prompt);

  return tokens.length + images * VISION_MAX_TOKENS;
}

export async function readModelInfo(path: string): Promise<ModelInfo> {
  const raw = (await loadLlamaModelInfo(path)) as Record<string, unknown>;

  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = raw[key];
      if (value !== undefined && value !== null) {
        return value;
      }
    }
    return undefined;
  };

  const architecture = pick('general.architecture') as string | undefined;

  return {
    architecture,
    paramCount: asNumber(pick('general.parameter_count', 'n_params')),
    contextLength: asNumber(
      architecture
        ? pick(`${architecture}.context_length`)
        : findBySuffix(raw, '.context_length'),
    ),
    quant: pick('general.file_type', 'quantization') as string | undefined,
  };
}

function findBySuffix(raw: Record<string, unknown>, suffix: string) {
  const key = Object.keys(raw).find(candidate => candidate.endsWith(suffix));
  return key ? raw[key] : undefined;
}

function asNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed)
    ? parsed
    : undefined;
}

export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === 'string' ? error : 'Unknown error';
}
