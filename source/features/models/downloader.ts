import {
  DocumentDirectoryPath,
  downloadFile,
  exists,
  mkdir,
  moveFile,
  stopDownload,
} from '@dr.pogodin/react-native-fs';

import { removeFile } from '@/core/fs';
import { MODEL_DIR_NAME } from './constants';
import { buildDownloadUrl } from './huggingface';

export const MODEL_DIR = `${DocumentDirectoryPath}/${MODEL_DIR_NAME}`;

/**
 * Where a downloaded file lives, by extension.
 *
 * Whisper models are GGML `.bin` rather than GGUF. Both loaders sniff the
 * file's magic, so the suffix is only there for a human reading the directory.
 */
export function assetPath(modelId: string, extension: string): string {
  return `${MODEL_DIR}/${modelId}${extension}`;
}

export function modelPath(modelId: string): string {
  return assetPath(modelId, '.gguf');
}

export function projectorPath(modelId: string): string {
  return `${MODEL_DIR}/${modelId}.mmproj.gguf`;
}

export async function ensureModelDir(): Promise<void> {
  if (!(await exists(MODEL_DIR))) {
    await mkdir(MODEL_DIR);
  }
}

export interface StartDownloadArgs {
  target: string;
  repo: string;
  filename: string;
  onBegin: (jobId: number, contentLength: number) => void;
  onProgress: (bytesWritten: number, contentLength: number) => void;
}

export async function startModelDownload({
  target,
  repo,
  filename,
  onBegin,
  onProgress,
}: StartDownloadArgs): Promise<string> {
  await ensureModelDir();

  const partial = `${target}.part`;

  await removeFile(partial);

  const { jobId, promise } = downloadFile({
    fromUrl: buildDownloadUrl(repo, filename),
    toFile: partial,
    background: true,
    discretionary: false,
    progressInterval: 500,
    begin: ({ contentLength }) => onBegin(jobId, contentLength),
    progress: ({ bytesWritten, contentLength }) =>
      onProgress(bytesWritten, contentLength),
  });

  try {
    const { statusCode } = await promise;
    if (statusCode < 200 || statusCode >= 300) {
      throw new Error(`Download failed (HTTP ${statusCode})`);
    }
    await moveFile(partial, target);
    return target;
  } catch (error) {
    await removeFile(partial);
    throw error;
  }
}

export function cancelModelDownload(jobId: number): void {
  stopDownload(jobId);
}
