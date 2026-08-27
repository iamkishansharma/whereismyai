export interface ModelFile {
  repo: string;
  filename: string;
  sizeBytes: number;
}

/** The multimodal projector that lets a vision model turn pixels into tokens. */
export interface ProjectorFile {
  filename: string;
  sizeBytes: number;
}

export interface CatalogModel extends ModelFile {
  id: string;
  name: string;
  publisher: string;
  params: string;
  quant: string;
  blurb: string;
  mmproj?: ProjectorFile;
}

export interface HfRepo {
  id: string;
  downloads: number;
  likes: number;
  tags: string[];
}

/** Read from the GGUF header, not from the catalog entry. */
export interface ModelInfo {
  architecture?: string;
  paramCount?: number;
  contextLength?: number;
  quant?: string;
}

export interface InstalledModel extends ModelFile {
  id: string;
  name: string;
  path: string;
  downloadedAt: number;
  info?: ModelInfo;
  mmproj?: ProjectorFile;
  mmprojPath?: string;
}

export type DownloadStatus = 'queued' | 'downloading' | 'failed';

export interface DownloadTask {
  modelId: string;
  jobId?: number;
  bytesWritten: number;
  contentLength: number;
  status: DownloadStatus;
  error?: string;
}

export interface GenerationSettings {
  systemPrompt: string;
  temperature: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  nPredict: number;
  nCtx: number;
  nGpuLayers: number;
}

export type EngineState = 'idle' | 'loading' | 'ready' | 'error';
