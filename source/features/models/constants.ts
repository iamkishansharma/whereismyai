import type { GenerationSettings } from '@/types';

/**
 * Kept short: it is charged against the same window as the chat history, so
 * every token here is one fewer turn the model remembers. The capability line
 * earns its place — there is no tool use, and a model left to guess will claim
 * it searched the web.
 */
export const DEFAULT_SYSTEM_PROMPT = `You are WIMAI (Where Is My AI), a helpful assistant running entirely on the user's device.

You cannot browse the web, run code, or access external files yet. You know only what is in this conversation and your knowledge. Say so plainly rather than inventing an answer.

Be concise and direct.`;

/**
 * Below ~0.5B a model continues the system prompt rather than acting on it —
 * SmolLM2 135M answered "Your capabilities are as follows…". Less text to
 * imitate, less of that.
 */
export const MINIMAL_SYSTEM_PROMPT =
  "You are WIMAI, a helpful AI assistant running on the user's device.";

/** Heuristic: size proxies for how well a model holds a role, and it is the
 * only signal available before it has run. */
const MINIMAL_PROMPT_MAX_BYTES = 350 * 1024 * 1024;

/** The standing instructions this model can actually be trusted to follow. */
export function systemPromptFor(sizeBytes: number): string {
  return sizeBytes > 0 && sizeBytes < MINIMAL_PROMPT_MAX_BYTES
    ? MINIMAL_SYSTEM_PROMPT
    : DEFAULT_SYSTEM_PROMPT;
}

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 1,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  nPredict: 512,
  nCtx: 2048,
  nGpuLayers: 99,
};
