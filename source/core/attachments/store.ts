import { copyFile, exists, mkdir } from '@dr.pogodin/react-native-fs';
import uuid from 'react-native-uuid';
import type { Asset } from 'react-native-image-picker';

import { removeFile } from '@/core/fs';
import { ATTACHMENTS_DIR } from '@/core/paths';
import type { Attachment } from '@/types';

export const ATTACHMENT_DIR = ATTACHMENTS_DIR;

async function ensureAttachmentDir(): Promise<void> {
  if (!(await exists(ATTACHMENT_DIR))) {
    await mkdir(ATTACHMENT_DIR);
  }
}

function extensionFor(asset: Asset): string {
  const fromName = asset.fileName?.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) {
    return fromName;
  }
  const fromType = asset.type?.split('/').pop()?.toLowerCase();
  return fromType && fromType.length <= 5 ? fromType : 'jpg';
}

/**
 * The picker returns a temporary uri that the OS is free to reclaim. Copy it
 * into app storage so history still renders after a relaunch and llama.rn
 * gets a path that still exists on the next send.
 */
export async function persistPickedImage(
  asset: Asset,
): Promise<Attachment | undefined> {
  if (!asset.uri) {
    return undefined;
  }

  await ensureAttachmentDir();

  const id = String(uuid.v4());
  const target = `${ATTACHMENT_DIR}/${id}.${extensionFor(asset)}`;

  await copyFile(asset.uri, target);

  return {
    id,
    messageId: '',
    kind: 'image',
    uri: `file://${target}`,
    mimeType: asset.type,
    width: asset.width,
    height: asset.height,
    sizeBytes: asset.fileSize,
  };
}

export async function deleteAttachments(files: Attachment[]): Promise<void> {
  await Promise.all(
    files.map(file => removeFile(file.uri.replace(/^file:\/\//, ''))),
  );
}
