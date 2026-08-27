import type { RNLlamaOAICompatibleMessage } from 'llama.rn';

import type { MessageRole } from '@/types';

/**
 * What the projector prefills for one image. Kept in step with the
 * image_max_tokens passed to initMultimodal.
 */
export const IMAGE_TOKEN_COST = 512;

/** A vision model needs room for an image plus the conversation around it. */
export const VISION_MIN_CTX = 4096;

const IMAGE_PLACEHOLDER = '[image]';
const PLACEHOLDER_COST = 3;

// Rough for English prose and generous enough that the exact count measured
// later usually agrees. Only used to choose which turns to try.
const CHARS_PER_TOKEN = 3.5;
// Role tags and delimiters the chat template wraps around every message.
const TURN_OVERHEAD = 8;

const CTX_STEP = 512;
const CTX_MIN = 512;
const CTX_FALLBACK = 4096;
const GB = 1024 ** 3;

interface SizedModel {
  sizeBytes: number;
  info?: { contextLength?: number };
  mmproj?: { sizeBytes: number };
  mmprojPath?: string;
}

/**
 * The KV cache is roughly 2 * n_layer * n_ctx * kv_dim * 2 bytes and stays
 * resident for the whole session, so the ceiling has to come down as the model
 * goes up. A 0.5B at 8192 costs ~100MB; a 7B at the same size costs ~1GB.
 */
export function capForSize(sizeBytes: number): number {
  if (sizeBytes < 1.5 * GB) {
    return 8192;
  }
  if (sizeBytes < 4 * GB) {
    return 4096;
  }
  return 2048;
}

/**
 * The context size to load a model with. Prefers what the GGUF declares over a
 * flat default, then clamps it to something a phone can hold.
 */
export function resolveContextSize(model: SizedModel): number {
  const declared = model.info?.contextLength ?? CTX_FALLBACK;
  const weight = model.sizeBytes + (model.mmproj?.sizeBytes ?? 0);

  const capped = Math.min(declared, capForSize(weight));
  // Land on a value the settings slider can also produce, so the number shown
  // there is the number actually used.
  const stepped = Math.floor(capped / CTX_STEP) * CTX_STEP;

  const floor = model.mmprojPath ? VISION_MIN_CTX : CTX_MIN;
  return Math.max(floor, stepped);
}

export interface HistoryMessage {
  id: string;
  role: MessageRole;
  content: string;
  attachments?: { uri: string }[];
}

export interface WindowedPrompt {
  messages: RNLlamaOAICompatibleMessage[];
  /**
   * Oldest message that survived, set only when something was dropped. The
   * transcript shows its divider above this message.
   */
  trimmedFromId?: string;
  /** The newest turn does not fit even on its own. */
  overflow: boolean;
}

function imageCount(message: HistoryMessage): number {
  return message.attachments?.length ?? 0;
}

function costOf(message: HistoryMessage, sendImages: boolean): number {
  const text = Math.ceil(message.content.length / CHARS_PER_TOKEN);
  const images =
    imageCount(message) * (sendImages ? IMAGE_TOKEN_COST : PLACEHOLDER_COST);
  return TURN_OVERHEAD + text + images;
}

function toPromptMessage(
  message: HistoryMessage,
  sendImages: boolean,
): RNLlamaOAICompatibleMessage {
  const uris = message.attachments?.map(file => file.uri) ?? [];

  if (sendImages && uris.length) {
    const parts: object[] = uris.map(url => ({
      type: 'image_url',
      image_url: { url },
    }));
    // An empty text part becomes a stray delimiter in some templates.
    if (message.content.trim()) {
      parts.push({ type: 'text', text: message.content });
    }
    return {
      role: message.role,
      content: parts,
    } as RNLlamaOAICompatibleMessage;
  }

  // Without the projector — or once the images no longer fit — say that a
  // picture was here rather than dropping the turn and losing the exchange.
  const marker = uris.map(() => IMAGE_PLACEHOLDER).join(' ');
  const content = [marker, message.content].filter(Boolean).join('\n').trim();
  return { role: message.role, content };
}

/**
 * Fits as much recent history as the budget allows, newest first. History has
 * to stay contiguous, so the walk stops at the first turn that will not fit
 * instead of skipping it and stitching an older one on.
 */
export function buildWindowedPrompt(options: {
  history: HistoryMessage[];
  systemPrompt: string;
  withVision: boolean;
  budget: number;
}): WindowedPrompt {
  const { history, systemPrompt, withVision } = options;

  const prompt = systemPrompt.trim();
  const systemCost = prompt
    ? TURN_OVERHEAD + Math.ceil(prompt.length / CHARS_PER_TOKEN)
    : 0;
  const budget = options.budget - systemCost;

  const usable = history.filter(
    message => message.content.trim() || imageCount(message),
  );

  const kept: RNLlamaOAICompatibleMessage[] = [];
  let oldestKeptId: string | undefined;
  let spent = 0;
  let trimmed = false;

  for (let index = usable.length - 1; index >= 0; index -= 1) {
    const message = usable[index];

    const withImages = withVision && imageCount(message) > 0;
    const full = costOf(message, withImages);

    if (spent + full <= budget) {
      kept.unshift(toPromptMessage(message, withImages));
      oldestKeptId = message.id;
      spent += full;
      continue;
    }

    // The images are what pushed it over. Keeping the words and marking the
    // picture beats dropping the turn — and the rest of the chat with it.
    const degraded = costOf(message, false);
    if (withImages && spent + degraded <= budget) {
      kept.unshift(toPromptMessage(message, false));
      oldestKeptId = message.id;
      spent += degraded;
      continue;
    }

    trimmed = true;
    break;
  }

  const messages = prompt
    ? [
        { role: 'system', content: prompt } as RNLlamaOAICompatibleMessage,
        ...kept,
      ]
    : kept;

  return {
    messages,
    trimmedFromId: trimmed ? oldestKeptId : undefined,
    overflow: kept.length === 0 && usable.length > 0,
  };
}
