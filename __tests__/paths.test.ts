import { toAbsolute, toFileUrl, toRelative } from '@/core/paths';

// jest.setup mocks DocumentDirectoryPath as '/tmp'.
const DOCS = '/tmp';

describe('toRelative', () => {
  it('strips the documents directory', () => {
    expect(toRelative(`${DOCS}/models/qwen.gguf`)).toBe('models/qwen.gguf');
  });

  it('strips a file:// prefix too', () => {
    expect(toRelative(`file://${DOCS}/attachments/a1.jpg`)).toBe(
      'attachments/a1.jpg',
    );
  });

  it('leaves an already-relative path alone', () => {
    expect(toRelative('models/qwen.gguf')).toBe('models/qwen.gguf');
  });

  it('is idempotent', () => {
    const once = toRelative(`${DOCS}/models/qwen.gguf`);
    expect(toRelative(once)).toBe(once);
  });
});

describe('toAbsolute', () => {
  it('round-trips an absolute path', () => {
    const absolute = `${DOCS}/models/qwen.gguf`;
    expect(toAbsolute(toRelative(absolute))).toBe(absolute);
  });

  it('re-homes a path written under a different container', () => {
    // The bug this exists for: iOS rebuilds the container under a new UUID on
    // restore, so yesterday's absolute path points nowhere. Stored relative,
    // it resolves against wherever the app lives today.
    const fromOldInstall =
      '/var/mobile/Containers/Data/Application/OLD-UUID/Documents/models/qwen.gguf';
    const relative = toRelative(fromOldInstall);

    expect(relative).toBe('models/qwen.gguf');
    expect(toAbsolute(relative)).toBe(`${DOCS}/models/qwen.gguf`);
  });
});

describe('toFileUrl', () => {
  it('produces a uri the image renderer can use', () => {
    expect(toFileUrl('attachments/a1.jpg')).toBe(
      `file://${DOCS}/attachments/a1.jpg`,
    );
  });

  it('does not double up the scheme', () => {
    expect(toFileUrl(toRelative(`file://${DOCS}/attachments/a1.jpg`))).toBe(
      `file://${DOCS}/attachments/a1.jpg`,
    );
  });
});
