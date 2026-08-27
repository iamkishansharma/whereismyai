import type { CatalogModel } from '@/types';
import { modelIdFor } from './huggingface';

const entries: Omit<CatalogModel, 'id'>[] = [
  {
    name: 'SmolLM2 135M Instruct',
    publisher: 'HuggingFaceTB',
    repo: 'lmstudio-community/SmolLM2-135M-Instruct-GGUF',
    filename: 'SmolLM2-135M-Instruct-Q4_K_M.gguf',
    sizeBytes: 110100480,
    params: '135M',
    quant: 'Q4_K_M',
    blurb: 'Very small local model. Good for testing and low-end devices.',
  },
  {
    name: 'Qwen2.5 0.5B Instruct',
    publisher: 'Qwen',
    repo: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF',
    filename: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    sizeBytes: 491400032,
    params: '0.5B',
    quant: 'Q4_K_M',
    blurb: 'Smallest and fastest. Good starting point on any device.',
  },
  {
    name: 'Llama 3.2 1B Instruct',
    publisher: 'Meta',
    repo: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
    filename: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    sizeBytes: 807694464,
    params: '1B',
    quant: 'Q4_K_M',
    blurb: 'Strong instruction following for its size.',
  },
  {
    name: 'SmolLM2 1.7B Instruct',
    publisher: 'HuggingFaceTB',
    repo: 'bartowski/SmolLM2-1.7B-Instruct-GGUF',
    filename: 'SmolLM2-1.7B-Instruct-Q4_K_M.gguf',
    sizeBytes: 1055609824,
    params: '1.7B',
    quant: 'Q4_K_M',
    blurb: 'Trained for on-device use. Chatty for its footprint.',
  },
  {
    name: 'Qwen2.5 1.5B Instruct',
    publisher: 'Qwen',
    repo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    sizeBytes: 1117320736,
    params: '1.5B',
    quant: 'Q4_K_M',
    blurb: 'Noticeably better reasoning than the 0.5B.',
  },
  {
    name: 'Gemma 2 2B Instruct',
    publisher: 'Google',
    repo: 'bartowski/gemma-2-2b-it-GGUF',
    filename: 'gemma-2-2b-it-Q4_K_M.gguf',
    sizeBytes: 1708582752,
    params: '2B',
    quant: 'Q4_K_M',
    blurb: 'Well-rounded. Needs a recent device to feel quick.',
  },
  {
    name: 'Llama 3.2 3B Instruct',
    publisher: 'Meta',
    repo: 'bartowski/Llama-3.2-3B-Instruct-GGUF',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    sizeBytes: 2019377696,
    params: '3B',
    quant: 'Q4_K_M',
    blurb: 'Best quality here. Expect 3GB+ of RAM in use.',
  },
];

const visionEntries: Omit<CatalogModel, 'id'>[] = [
  {
    name: 'SmolVLM 256M',
    publisher: 'HuggingFaceTB',
    repo: 'ggml-org/SmolVLM-256M-Instruct-GGUF',
    filename: 'SmolVLM-256M-Instruct-Q8_0.gguf',
    sizeBytes: 175054528,
    params: '256M',
    quant: 'Q8_0',
    blurb: 'Smallest model that can see. Best place to start.',
    mmproj: {
      filename: 'mmproj-SmolVLM-256M-Instruct-Q8_0.gguf',
      sizeBytes: 103769856,
    },
  },
  {
    name: 'LFM2-VL 450M',
    publisher: 'Liquid AI',
    repo: 'ggml-org/LFM2-VL-450M-GGUF',
    filename: 'LFM2-VL-450M-Q8_0.gguf',
    sizeBytes: 379215264,
    params: '450M',
    quant: 'Q8_0',
    blurb: 'Fast vision model tuned for edge devices.',
    mmproj: {
      filename: 'mmproj-LFM2-VL-450M-Q8_0.gguf',
      sizeBytes: 103890016,
    },
  },
  {
    name: 'SmolVLM 500M',
    publisher: 'HuggingFaceTB',
    repo: 'ggml-org/SmolVLM-500M-Instruct-GGUF',
    filename: 'SmolVLM-500M-Instruct-Q8_0.gguf',
    sizeBytes: 436806912,
    params: '500M',
    quant: 'Q8_0',
    blurb: 'Clearly better image descriptions than the 256M.',
    mmproj: {
      filename: 'mmproj-SmolVLM-500M-Instruct-Q8_0.gguf',
      sizeBytes: 108783360,
    },
  },
  {
    name: 'SmolVLM2 500M Video',
    publisher: 'HuggingFaceTB',
    repo: 'ggml-org/SmolVLM2-500M-Video-Instruct-GGUF',
    filename: 'SmolVLM2-500M-Video-Instruct-Q8_0.gguf',
    sizeBytes: 436808704,
    params: '500M',
    quant: 'Q8_0',
    blurb: 'Newer SmolVLM generation, stronger at scenes.',
    mmproj: {
      filename: 'mmproj-SmolVLM2-500M-Video-Instruct-Q8_0.gguf',
      sizeBytes: 108785184,
    },
  },
  {
    name: 'Qwen2.5-VL 3B',
    publisher: 'Qwen',
    repo: 'ggml-org/Qwen2.5-VL-3B-Instruct-GGUF',
    filename: 'Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf',
    sizeBytes: 1929901056,
    params: '3B',
    quant: 'Q4_K_M',
    blurb: 'Reads text in images well. Needs a recent device.',
    mmproj: {
      filename: 'mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf',
      sizeBytes: 844757728,
    },
  },
  {
    name: 'Gemma 3 4B',
    publisher: 'Google',
    repo: 'ggml-org/gemma-3-4b-it-GGUF',
    filename: 'gemma-3-4b-it-Q4_K_M.gguf',
    sizeBytes: 2489757856,
    params: '4B',
    quant: 'Q4_K_M',
    blurb: 'Strongest vision here. Over 3GB with the projector.',
    mmproj: {
      filename: 'mmproj-model-f16.gguf',
      sizeBytes: 851251104,
    },
  },
];

const withIds = (list: Omit<CatalogModel, 'id'>[]): CatalogModel[] =>
  list.map(entry => ({ ...entry, id: modelIdFor(entry.repo, entry.filename) }));

export const CATALOG: CatalogModel[] = withIds(entries);
export const VISION_CATALOG: CatalogModel[] = withIds(visionEntries);

/**
 * Offered directly in onboarding so a new install can start chatting without
 * first learning what a quant is. Small enough to download over cellular,
 * capable enough to be worth keeping.
 */
export const STARTER_MODEL: CatalogModel = withIds([
  {
    name: 'Qwen2.5 0.5B Instruct',
    publisher: 'Qwen',
    repo: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF',
    filename: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    sizeBytes: 491400032,
    params: '0.5B',
    quant: 'Q4_K_M',
    blurb: 'A good first model — small, quick, and runs on any device.',
  },
])[0];
