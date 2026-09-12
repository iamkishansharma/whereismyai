import type { GenerationSettings } from '@/types';

/**
 * The assistant's standing instructions, sent ahead of every conversation.
 *
 * Kept deliberately short. It is charged against the same window as the chat
 * history — `nCtx - nPredict - margin` leaves about 1,472 tokens at the
 * defaults — so every token spent here is one fewer turn the model can
 * remember, on every single message. Small models also follow three plain
 * instructions far better than ten careful ones.
 *
 * The capability line is the part that earns its keep: there is no tool use in
 * this app, so a model left to guess will happily claim to have searched the
 * web. Naming the limit stops that.
 */
export const DEFAULT_SYSTEM_PROMPT = `You are WIMAI (Where Is My AI), a helpful assistant running entirely on the user's device.

You cannot browse the web, run code, or access external files yet. You know only what is in this conversation and your knowledge. Say so plainly rather than inventing an answer.

Be concise and direct.`;

/**
 * The prompt for models too small to follow a longer one.
 *
 * Below roughly half a billion parameters a model tends to *continue* the
 * system prompt rather than act on it: asked "what are your capabilities",
 * SmolLM2 135M replied "Your capabilities are as follows…", carrying on the
 * second-person voice it had just been given. The less instruction text there
 * is to imitate, the less of this happens, so the smallest models get an
 * identity and nothing else.
 */
export const MINIMAL_SYSTEM_PROMPT =
  "You are WIMAI, a helpful AI assistant running on the user's device.";

/**
 * Weight below which a model gets {@link MINIMAL_SYSTEM_PROMPT}.
 *
 * A heuristic, and size is only a proxy for how well a model holds a role —
 * but it is the one signal available before the model has ever run. 350MB puts
 * the 135M and 350M models on the short prompt and leaves 0.5B upwards on the
 * full one.
 */
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
