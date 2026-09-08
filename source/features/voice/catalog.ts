import type { VoiceAsset } from '@/types';
import { modelIdFor } from '@/features/models/huggingface';

/**
 * The files voice needs, all from Hugging Face and all runnable on device.
 *
 * Sizes are the exact byte counts from each repo's file tree — the download
 * rows show them before anything is fetched, so a guess would be a small lie
 * about a large download.
 */

const withVoiceIds = (entries: Omit<VoiceAsset, 'id'>[]): VoiceAsset[] =>
  entries.map(entry => ({
    ...entry,
    id: modelIdFor(entry.repo, entry.filename),
  }));

const WHISPER_REPO = 'ggerganov/whisper.cpp';

/**
 * Whisper, quantised to Q5_1 — a third of the size of the float builds for no
 * accuracy anyone will notice at this scale.
 *
 * The `.en` variants are meaningfully sharper on English than the multilingual
 * ones at the same size, so both are offered rather than picking for the user.
 */
export const SPEECH_CATALOG = withVoiceIds([
  {
    name: 'Whisper Tiny (English)',
    repo: WHISPER_REPO,
    filename: 'ggml-tiny.en-q5_1.bin',
    sizeBytes: 32166155,
    role: 'speech',
    extension: '.bin',
    blurb: 'Fastest, English only. Comfortable on any device.',
  },
  {
    name: 'Whisper Tiny',
    repo: WHISPER_REPO,
    filename: 'ggml-tiny-q5_1.bin',
    sizeBytes: 32152673,
    role: 'speech',
    extension: '.bin',
    blurb: 'Fastest, and understands many languages.',
  },
  {
    name: 'Whisper Base (English)',
    repo: WHISPER_REPO,
    filename: 'ggml-base.en-q5_1.bin',
    sizeBytes: 59721011,
    role: 'speech',
    extension: '.bin',
    blurb: 'Noticeably more accurate than Tiny. English only.',
  },
  {
    name: 'Whisper Base',
    repo: WHISPER_REPO,
    filename: 'ggml-base-q5_1.bin',
    sizeBytes: 59707625,
    role: 'speech',
    extension: '.bin',
    blurb: 'More accurate than Tiny, and multilingual.',
  },
  {
    name: 'Whisper Small (English)',
    repo: WHISPER_REPO,
    filename: 'ggml-small.en-q5_1.bin',
    sizeBytes: 190098681,
    role: 'speech',
    extension: '.bin',
    blurb: 'Best accuracy here, but slower and much larger.',
  },
]);

/** Sensible default: small, fast, and the most common case. */
export const DEFAULT_SPEECH_ASSET = SPEECH_CATALOG[0];

/**
 * Silero, the speech/silence detector that decides when a turn has ended.
 *
 * Under a megabyte, so it is fetched alongside whichever whisper model the user
 * picks rather than presented as a choice.
 */
export const VAD_ASSET = withVoiceIds([
  {
    name: 'Speech detector',
    repo: 'ggml-org/whisper-vad',
    filename: 'ggml-silero-v5.1.2.bin',
    sizeBytes: 885098,
    role: 'vad',
    extension: '.bin',
    blurb: 'Knows when you start and stop talking. Under a megabyte.',
  },
])[0];

/**
 * OuteTTS and its vocoder — the assistant's voice.
 *
 * These two are a matched pair and useless apart: llama.rn's `decodeAudioTokens`
 * only understands OuteTTS's audio-token range, and those tokens only become
 * sound through WavTokenizer. Q4_0 rather than a K-quant because it has the ARM
 * dot-product kernels and this workload is decode-bound.
 */
export const TTS_ASSET = withVoiceIds([
  {
    name: 'OuteTTS 0.2 500M',
    repo: 'OuteAI/OuteTTS-0.2-500M-GGUF',
    filename: 'OuteTTS-0.2-500M-Q4_0.gguf',
    sizeBytes: 357753472,
    role: 'tts',
    extension: '.gguf',
    blurb: 'Turns replies into speech, entirely on this device.',
  },
])[0];

export const VOCODER_ASSET = withVoiceIds([
  {
    name: 'WavTokenizer',
    repo: 'ggml-org/WavTokenizer',
    filename: 'WavTokenizer-Large-75-Q5_1.gguf',
    sizeBytes: 73319616,
    role: 'vocoder',
    extension: '.gguf',
    blurb: 'Turns the voice model’s output into audio.',
  },
])[0];

/**
 * A voice capability as one download.
 *
 * Speech needs whisper plus the speech detector; the assistant's voice needs
 * OuteTTS plus its vocoder. Neither is useful half-installed, so they are
 * presented and fetched as a unit — the same way a vision model and its
 * projector are already one row with one progress bar.
 */
export interface VoiceBundle {
  /** The primary asset's id, which also keys the download task. */
  id: string;
  name: string;
  blurb: string;
  purpose: 'speech' | 'tts';
  /** Every file the capability needs, primary first. */
  assets: VoiceAsset[];
  /** Combined download size, so the bar never resets between parts. */
  sizeBytes: number;
}

const bundle = (
  purpose: VoiceBundle['purpose'],
  primary: VoiceAsset,
  companions: VoiceAsset[],
  blurb = primary.blurb,
): VoiceBundle => ({
  id: primary.id,
  name: primary.name,
  blurb,
  purpose,
  assets: [primary, ...companions],
  sizeBytes: [primary, ...companions].reduce(
    (total, asset) => total + asset.sizeBytes,
    0,
  ),
});

/**
 * Each speech model carries the detector with it. It is under a megabyte and
 * without it there is no way to tell when a turn has ended, so offering it as a
 * separate decision would only be a way to get voice chat subtly wrong.
 */
export const SPEECH_BUNDLES: VoiceBundle[] = SPEECH_CATALOG.map(asset =>
  bundle('speech', asset, [VAD_ASSET]),
);

export const DEFAULT_SPEECH_BUNDLE = SPEECH_BUNDLES[0];

export const VOICE_OUTPUT_BUNDLE: VoiceBundle = bundle(
  'tts',
  TTS_ASSET,
  [VOCODER_ASSET],
  'Speaks replies aloud, entirely on this device.',
);

/** Downloaded together, because neither half does anything alone. */
export const VOICE_OUTPUT_ASSETS = [TTS_ASSET, VOCODER_ASSET];

export const VOICE_OUTPUT_BYTES = VOICE_OUTPUT_BUNDLE.sizeBytes;

/** Every asset the voice features can install, for lookups by id. */
export const ALL_VOICE_ASSETS: VoiceAsset[] = [
  ...SPEECH_CATALOG,
  VAD_ASSET,
  ...VOICE_OUTPUT_ASSETS,
];

export function voiceAssetById(id: string): VoiceAsset | undefined {
  return ALL_VOICE_ASSETS.find(asset => asset.id === id);
}
