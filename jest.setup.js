require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-worklets', () =>
  require('react-native-worklets/lib/module/mock.js'),
);

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

// Native modules with no JS fallback. Without these any test that mounts the
// app fails on a missing base module rather than on anything it meant to check.
jest.mock('@op-engineering/op-sqlite', () => ({
  open: () => ({
    execute: jest.fn(async () => ({ rows: [] })),
    executeSync: jest.fn(() => ({ rows: [] })),
    executeRaw: jest.fn(async () => ({ rawRows: [] })),
    close: jest.fn(),
  }),
}));

jest.mock('drizzle-orm/op-sqlite/migrator', () => ({
  useMigrations: () => ({ success: true, error: undefined }),
}));

jest.mock('llama.rn', () => ({
  initLlama: jest.fn(),
  loadLlamaModelInfo: jest.fn(async () => ({})),
  releaseAllLlama: jest.fn(async () => {}),
  RNLLAMA_MTMD_DEFAULT_MEDIA_MARKER: '<__media__>',
}));

// Ships a first-party mock, so there is nothing to hand-roll here.
jest.mock('react-native-audio-api', () =>
  require('react-native-audio-api/mock'),
);

// Mocked virtually: whisper.rn 0.7.4 declares `exports` with only "./*" and
// no "." entry, so the bare specifier is unresolvable to Jest's strict
// resolver. Metro falls back to `main` and loads it fine at runtime.
jest.mock(
  'whisper.rn',
  () => ({
    initWhisper: jest.fn(),
    initWhisperVad: jest.fn(),
    releaseAllWhisper: jest.fn(async () => {}),
    releaseAllWhisperVad: jest.fn(async () => {}),
  }),
  { virtual: true },
);

jest.mock(
  'whisper.rn/realtime-transcription/index',
  () => ({
    RealtimeTranscriber: jest.fn(() => ({
      start: jest.fn(async () => {}),
      stop: jest.fn(async () => {}),
      release: jest.fn(async () => {}),
      updateCallbacks: jest.fn(),
    })),
    RingBufferVad: jest.fn(),
  }),
  { virtual: true },
);

jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp',
  copyFile: jest.fn(async () => {}),
  downloadFile: jest.fn(() => ({ jobId: 1, promise: Promise.resolve() })),
  exists: jest.fn(async () => false),
  mkdir: jest.fn(async () => {}),
  moveFile: jest.fn(async () => {}),
  stopDownload: jest.fn(),
  unlink: jest.fn(async () => {}),
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));
