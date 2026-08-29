import type { GenerationSettings } from '@/types';

export const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful, concise assistant running entirely on the user's device.";

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  nPredict: 512,
  nCtx: 2048,
  nGpuLayers: 99,
};

export const MODEL_DIR_NAME = 'models';
