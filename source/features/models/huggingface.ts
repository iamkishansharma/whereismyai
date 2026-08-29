import type { HfRepo, ModelFile, ProjectorFile } from '@/types';

const API = 'https://huggingface.co/api';
const HOST = 'https://huggingface.co';

// https://huggingface.co/models-json?pipeline_tag=text-generation&num_parameters=min%3A0%2Cmax%3A3B&library=gguf&apps=llama.cpp&language=en%3Ane&sort=trending&withCount=true

type TitleValue = { title: string; value: string };

export const PIPELINE_TAGS: TitleValue[] = [
  { value: 'text-generation', title: 'Text Generation' },
  { value: 'text-classification', title: 'Text Classification' },
  { value: 'translation', title: 'Translation' },
  { value: 'text-to-image', title: 'Text to Image' },
  { value: 'text-to-speech', title: 'Text to Speech' },
  { value: 'text-to-audio', title: 'Text to Audio' },
  { value: 'text-to-video', title: 'Text to Video' },
  { value: 'image-to-text', title: 'Image to Text' },
  { value: 'object-detection', title: 'Object Detection' },
  { value: 'any-to-any', title: 'Any to Any' },
  {
    value: 'document-question-answering',
    title: 'Document Question Answering',
  },
  { value: 'question-answering', title: 'Question Answering' },
] as const;

export const SORT_OPTIONS: TitleValue[] = [
  { value: 'trending', title: 'Trending' },
  { value: 'downloads', title: 'Most downloads' },
  { value: 'likes', title: 'Most likes' },
  { value: 'created', title: 'Recently created' },
  { value: 'modified', title: 'Recently updated' },
  { value: 'most_params', title: 'Most parameters' },
  { value: 'least_params', title: 'Least parameters' },
];
export const LANGUAGE_OPTIONS = [
  { title: 'Multilingual', value: 'multilingual' },
  { title: 'Nepali', value: 'ne' },
  { title: 'English', value: 'en' },
  { title: 'Hindi', value: 'hi' },
  { title: 'Bengali', value: 'bn' },
  { title: 'Russian', value: 'ru' },
  { title: 'German', value: 'de' },
  { title: 'Spanish', value: 'es' },
  { title: 'French', value: 'fr' },
  { title: 'Chinese', value: 'zh' },
] as const;

export type PipelineTag = (typeof PIPELINE_TAGS)[number];

export type SortOption = (typeof SORT_OPTIONS)[number];

export type LanguageOption = (typeof LANGUAGE_OPTIONS)[number];

export type HfRepoFilters = {
  pipeline_tag?: PipelineTag;
  num_parameters?: `min:${number}B,max:${number}B`;
  library: 'gguf'; //allow only gguf
  apps: 'llama.cpp'; // allow only llama.cpp
  language?: LanguageOption[];
  sort?: SortOption;
  withCount?: 'true' | 'false';
  limit?: `${number}`;
};
export async function searchGgufRepos(
  query: string,
  signal?: AbortSignal,
  filters?: HfRepoFilters,
): Promise<HfRepo[]> {
  const filterParams: Record<string, string> = {
    filter: 'gguf',
    apps: 'llama.cpp',
    limit: filters?.limit ?? '30', // limit to 30 results by default
    // Include download and like counts.
    withCount: filters?.withCount ?? 'true',
    // `sort` and `language` are accepted by the endpoint and modelled in
    // SORT_OPTIONS / LANGUAGE_OPTIONS, but nothing in the UI sets them yet.
    ...(filters?.pipeline_tag
      ? { pipeline_tag: filters.pipeline_tag.value }
      : {}),
    ...(filters?.num_parameters
      ? { num_parameters: filters.num_parameters }
      : {}),
  };

  const params = new URLSearchParams(filterParams);
  if (query.trim()) {
    params.set('search', query.trim());
  }

  const response = await fetch(`${API}/models?${params}`, { signal });
  if (!response.ok) {
    throw new Error(`Hugging Face search failed (${response.status})`);
  }

  const raw = (await response.json()) as Array<{
    id: string;
    downloads?: number;
    likes?: number;
    tags?: string[];
  }>;

  return raw.map(repo => ({
    id: repo.id,
    downloads: repo.downloads ?? 0,
    likes: repo.likes ?? 0,
    tags: repo.tags ?? [],
  }));
}

export type RepoModel = ModelFile & { mmproj?: ProjectorFile };

export interface RepoContents {
  models: RepoModel[];
  isVision: boolean;
}

const isProjector = (path: string) => /mmproj/i.test(path);

/**
 * Projectors are published per repo, not per quant — the suffix on an mmproj
 * file is the projector's own precision, unrelated to the model's quant. F16 is
 * the reference precision llama.cpp ships and what mtmd is tuned against;
 * quantised projectors visibly weaken image understanding.
 */
export function pickProjector(
  projectors: ProjectorFile[],
): ProjectorFile | undefined {
  if (!projectors.length) {
    return undefined;
  }
  const byPreference = ['F16', 'BF16', 'Q8_0'];
  for (const wanted of byPreference) {
    const match = projectors.find(
      file => quantFromFilename(file.filename) === wanted,
    );
    if (match) {
      return match;
    }
  }
  return [...projectors].sort((a, b) => a.sizeBytes - b.sizeBytes)[0];
}

/**
 * Groups a repo into downloadable models, attaching the repo's projector to
 * every model when there is one, so a search result is the same shape the
 * curated catalog produces.
 */
export async function listRepoContents(
  repo: string,
  signal?: AbortSignal,
): Promise<RepoContents> {
  const response = await fetch(
    `${API}/models/${repo}/tree/main?recursive=true`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(`Could not list files for ${repo} (${response.status})`);
  }

  const raw = (await response.json()) as Array<{
    type: string;
    path: string;
    size?: number;
  }>;

  const ggufs = raw
    .filter(entry => entry.type === 'file' && entry.path.endsWith('.gguf'))
    // Sharded models need every part to load; we only support single-file GGUF.
    .filter(entry => !/-\d{5}-of-\d{5}\.gguf$/.test(entry.path));

  const projectors: ProjectorFile[] = ggufs
    .filter(entry => isProjector(entry.path))
    .map(entry => ({ filename: entry.path, sizeBytes: entry.size ?? 0 }));

  const mmproj = pickProjector(projectors);

  const models: RepoModel[] = ggufs
    .filter(entry => !isProjector(entry.path))
    .map(entry => ({
      repo,
      filename: entry.path,
      sizeBytes: entry.size ?? 0,
      ...(mmproj ? { mmproj } : null),
    }))
    .sort((a, b) => a.sizeBytes - b.sizeBytes);

  return { models, isVision: mmproj !== undefined };
}

/** Quants worth offering on a phone, in the order publishers usually ship them. */
const PHONE_QUANTS = ['Q4_K_S', 'Q4_K_M', 'Q5_K_S', 'Q5_K_M', 'Q6_K', 'Q8_0'];
const PHONE_SIZE_CEILING = 6 * 1024 ** 3;

export function isPhoneViable(model: RepoModel): boolean {
  const total = model.sizeBytes + (model.mmproj?.sizeBytes ?? 0);
  if (total > PHONE_SIZE_CEILING) {
    return false;
  }
  const quant = quantFromFilename(model.filename);
  return quant !== undefined && PHONE_QUANTS.includes(quant);
}

/**
 * "bartowski/google_gemma-3-4b-it-GGUF" -> "google gemma 3 4b it".
 * Repo names read better than raw filenames, which carry the quant twice.
 */
export function displayNameForRepo(repo: string): string {
  return (
    repo
      .split('/')
      .pop()
      ?.replace(/[-_]?GGUF$/i, '')
      .replace(/[-_]/g, ' ')
      .trim() || repo
  );
}

export function buildDownloadUrl(repo: string, filename: string): string {
  return `${HOST}/${repo}/resolve/main/${encodeURI(filename)}`;
}

export function repoUrl(repo: string): string {
  return `${HOST}/${repo}`;
}

export function modelIdFor(repo: string, filename: string): string {
  return `${repo}/${filename}`.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Quants are the trailing token of the basename and carry underscores
 * (`Q4_K_M`, `IQ4_XS`), so match the whole tail rather than stopping at the
 * first separator.
 */
export function quantFromFilename(filename: string): string | undefined {
  const basename = filename.replace(/\.gguf$/i, '');
  const match = basename.match(
    /(?:^|[.\-_])(I?Q\d+(?:_[A-Za-z0-9]+)*|BF16|F16|F32)$/i,
  );
  return match?.[1]?.toUpperCase();
}
