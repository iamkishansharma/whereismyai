import {
  launchCamera,
  launchImageLibrary,
  type ImagePickerResponse,
} from 'react-native-image-picker';

import { persistPickedImage } from './store';
import type { Attachment } from '@/types';

const options = {
  mediaType: 'photo',
  selectionLimit: 4,
  quality: 0.8 as const,
  // Vision prefill cost scales with resolution, and image_max_tokens caps the
  // detail anyway, so there is nothing to gain from a full-size original.
  maxWidth: 1536,
  maxHeight: 1536,
} as const;

async function toAttachments(
  response: ImagePickerResponse,
): Promise<Attachment[]> {
  if (response.didCancel || response.errorCode || !response.assets?.length) {
    if (response.errorCode && response.errorCode !== 'camera_unavailable') {
      throw new Error(response.errorMessage ?? response.errorCode);
    }
    return [];
  }

  const saved = await Promise.all(response.assets.map(persistPickedImage));
  return saved.filter((file): file is Attachment => file !== undefined);
}

export async function pickFromLibrary(): Promise<Attachment[]> {
  return toAttachments(await launchImageLibrary(options));
}

export async function capturePhoto(): Promise<Attachment[]> {
  // launchCamera has no selectionLimit — one capture at a time.
  const { mediaType, quality, maxWidth, maxHeight } = options;
  return toAttachments(
    await launchCamera({ mediaType, quality, maxWidth, maxHeight }),
  );
}
