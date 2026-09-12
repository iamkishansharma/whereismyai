import { DocumentDirectoryPath } from '@dr.pogodin/react-native-fs';

export const MODELS_DIR_NAME = 'models';
export const ATTACHMENTS_DIR_NAME = 'attachments';

export const MODELS_DIR = `${DocumentDirectoryPath}/${MODELS_DIR_NAME}`;
export const ATTACHMENTS_DIR = `${DocumentDirectoryPath}/${ATTACHMENTS_DIR_NAME}`;

/**
 * Only the part of a path that stays true across installs is stored.
 *
 * iOS rebuilds the app container under a new UUID on restore-from-backup, so
 * an absolute path written today can point nowhere tomorrow — which previously
 * made every model look uninstalled and every image look missing.
 */
export function toRelative(pathOrUrl: string): string {
  const path = pathOrUrl.replace(/^file:\/\//, '');

  const prefix = `${DocumentDirectoryPath}/`;
  if (path.startsWith(prefix)) {
    return path.slice(prefix.length);
  }

  // Written under a previous container, so the documents prefix no longer
  // matches. The app owns both of these directory names, so the part of the
  // path from there on is still the truth about which file this is.
  for (const dir of [MODELS_DIR_NAME, ATTACHMENTS_DIR_NAME]) {
    const marker = `/${dir}/`;
    const at = path.lastIndexOf(marker);
    if (at !== -1) {
      return path.slice(at + 1);
    }
  }

  return path;
}

/** Filesystem path, for react-native-fs and llama.rn. */
export function toAbsolute(relPath: string): string {
  return `${DocumentDirectoryPath}/${toRelative(relPath)}`;
}

/** file:// URL, for <Image> and anything that wants a URI. */
export function toFileUrl(relPath: string): string {
  return `file://${toAbsolute(relPath)}`;
}
