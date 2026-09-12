import { readDir } from '@dr.pogodin/react-native-fs';

import {
  loadAttachmentPaths,
  normalizeAttachmentPaths,
} from '@/core/db/chat-repository';
import { removeFile } from '@/core/fs';
import { ATTACHMENTS_DIR, ATTACHMENTS_DIR_NAME } from '@/core/paths';

export interface ReconcileResult {
  removedFiles: number;
}

/**
 * Deletes image files that no message points at any more.
 *
 * Files and rows are written in the same breath but can still diverge — a
 * download cancelled mid-copy, or a restore that brings files back without
 * their database. The row is authoritative; a file nothing references is
 * dead weight on a device where space matters.
 */
export async function reconcileAttachments(): Promise<ReconcileResult> {
  // Repair inherited absolute paths before comparing anything against disk.
  await normalizeAttachmentPaths();

  let entries;
  try {
    entries = await readDir(ATTACHMENTS_DIR);
  } catch {
    // No directory yet — nothing has been attached on this device.
    return { removedFiles: 0 };
  }

  const referenced = new Set(await loadAttachmentPaths());

  const orphans = entries.filter(
    entry =>
      entry.isFile() &&
      !referenced.has(`${ATTACHMENTS_DIR_NAME}/${entry.name}`),
  );

  await Promise.all(orphans.map(entry => removeFile(entry.path)));

  return { removedFiles: orphans.length };
}
