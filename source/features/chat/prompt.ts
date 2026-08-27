import type { LlamaContext } from 'llama.rn';

import {
  buildWindowedPrompt,
  measurePrompt,
  type WindowedPrompt,
} from '@/core/llama';
import type { Conversation, GenerationSettings, Message } from '@/types';

// Room left for the reply, plus slack for template tokens the estimate misses.
const PROMPT_SAFETY_MARGIN = 64;
const MEASURE_ATTEMPTS = 2;

/**
 * The conversation so far, oldest first, without the placeholder the reply is
 * about to stream into.
 */
export function historyFor(
  conversation: Conversation | undefined,
  messages: Record<string, Message>,
  replyMessageId: string,
): Message[] {
  return (conversation?.messageIds ?? [])
    .filter(id => id !== replyMessageId)
    .map(id => messages[id])
    .filter((message): message is Message => Boolean(message));
}

/**
 * Whether the message being answered right now carries images — it is the last
 * turn in the history. Older images are simply left out of the prompt, so
 * switching to a text model doesn't block the rest of the chat.
 */
export function answeringImages(history: Message[]): boolean {
  return Boolean(history[history.length - 1]?.attachments?.length);
}

/**
 * Fits the history into the model's window. The character estimate decides
 * which turns to try and the tokenizer settles it, so this normally runs a
 * single measuring pass.
 */
export async function buildPrompt(
  context: LlamaContext,
  options: {
    history: Message[];
    systemPrompt: string;
    withVision: boolean;
    settings: GenerationSettings;
  },
): Promise<WindowedPrompt> {
  const { history, systemPrompt, withVision, settings } = options;

  const ceiling = settings.nCtx - settings.nPredict - PROMPT_SAFETY_MARGIN;
  let budget = ceiling;
  let result = buildWindowedPrompt({
    history,
    systemPrompt,
    withVision,
    budget,
  });

  for (let attempt = 0; attempt < MEASURE_ATTEMPTS; attempt += 1) {
    if (result.overflow) {
      break;
    }

    let measured: number;
    try {
      measured = await measurePrompt(context, result.messages);
    } catch {
      // Counting is a refinement of the estimate, not a prerequisite.
      break;
    }

    if (measured <= ceiling) {
      break;
    }

    budget -= measured - ceiling;
    result = buildWindowedPrompt({
      history,
      systemPrompt,
      withVision,
      budget,
    });
  }

  return result;
}
