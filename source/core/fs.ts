import { exists, unlink } from '@dr.pogodin/react-native-fs';

/** Filesystem helpers shared by anything that keeps files on disk. */
export async function fileExists(path: string): Promise<boolean> {
  return exists(path);
}

export async function removeFile(path: string): Promise<void> {
  if (await exists(path)) {
    await unlink(path);
  }
}
