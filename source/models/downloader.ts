import {
  DocumentDirectoryPath,
  downloadFile,
  exists,
  mkdir,
  moveFile,
  stopDownload,
  unlink,
} from '@dr.pogodin/react-native-fs';

import { MODEL_DIR_NAME } from '@/constants';
import { buildDownloadUrl } from './huggingface';

export const MODEL_DIR = `${DocumentDirectoryPath}/${MODEL_DIR_NAME}`;

export function modelPath(modelId: string): string {
  return `${MODEL_DIR}/${modelId}.gguf`;
}

export function projectorPath(modelId: string): string {
  return `${MODEL_DIR}/${modelId}.mmproj.gguf`;
}

export async function ensureModelDir(): Promise<void> {
  if (!(await exists(MODEL_DIR))) {
    await mkdir(MODEL_DIR);
  }
}

export async function fileExists(path: string): Promise<boolean> {
  return exists(path);
}

export async function removeFile(path: string): Promise<void> {
  if (await exists(path)) {
    await unlink(path);
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
