import {
  buildWindowedPrompt,
  capForSize,
  resolveContextSize,
  VISION_MIN_CTX,
  type HistoryMessage,
} from '@/core/llama/context-window';

const GB = 1024 ** 3;

// 35 characters costs 10 estimated tokens, plus 8 turn overhead = 18.
const TURN = 'x'.repeat(35);
const TURN_COST = 18;

const user = (id: string, content = TURN): HistoryMessage => ({
  id,
  role: 'user',
  content,
});

const withImage = (id: string, content: string, count = 1): HistoryMessage => ({
  id,
  role: 'user',
  content,
  attachments: Array.from({ length: count }, (_, index) => ({
    uri: `file:///${id}-${index}.jpg`,
  })),
});

const build = (
  history: HistoryMessage[],
  budget: number,
  withVision = false,
  systemPrompt = '',
) => buildWindowedPrompt({ history, systemPrompt, withVision, budget });

const textOf = (content: unknown) =>
  typeof content === 'string' ? content : undefined;

const partsOf = (content: unknown) =>
  Array.isArray(content) ? (content as { type: string }[]) : undefined;

describe('capForSize', () => {
  it('lowers the ceiling as the model grows', () => {
    expect(capForSize(0.4 * GB)).toBe(8192);
    expect(capForSize(2 * GB)).toBe(4096);
    expect(capForSize(5 * GB)).toBe(2048);
  });
});

describe('resolveContextSize', () => {
  it('prefers what the GGUF declares over the flat default', () => {
    expect(
      resolveContextSize({
        sizeBytes: 0.4 * GB,
        info: { contextLength: 32768 },
      }),
    ).toBe(8192);
  });

  it('never exceeds what the model declares', () => {
    expect(
      resolveContextSize({
        sizeBytes: 0.4 * GB,
        info: { contextLength: 2048 },
      }),
    ).toBe(2048);
  });

  it('caps a large model even when it declares more', () => {
    expect(
      resolveContextSize({ sizeBytes: 5 * GB, info: { contextLength: 32768 } }),
    ).toBe(2048);
  });

  it('falls back when the header was never read', () => {
    expect(resolveContextSize({ sizeBytes: 0.4 * GB })).toBe(4096);
  });

  it('lands on a value the settings slider can also produce', () => {
    expect(
      resolveContextSize({
        sizeBytes: 0.4 * GB,
        info: { contextLength: 3000 },
      }) % 512,
    ).toBe(0);
  });

  it('keeps a vision model above the floor an image needs', () => {
    expect(
      resolveContextSize({
        sizeBytes: 5 * GB,
        mmprojPath: '/tmp/mmproj.gguf',
        info: { contextLength: 32768 },
      }),
    ).toBe(VISION_MIN_CTX);
  });
});

describe('buildWindowedPrompt', () => {
  it('keeps the whole conversation when it fits', () => {
    const result = build([user('a'), user('b'), user('c')], TURN_COST * 3);

    expect(result.messages).toHaveLength(3);
    expect(result.trimmedFromId).toBeUndefined();
    expect(result.overflow).toBe(false);
  });

  it('drops the oldest turns first and reports where it cut', () => {
    const result = build([user('a'), user('b'), user('c')], TURN_COST * 2);

    expect(result.messages).toHaveLength(2);
    expect(textOf(result.messages[0].content)).toBe(TURN);
    // 'b' is the oldest survivor, so the divider belongs above it.
    expect(result.trimmedFromId).toBe('b');
  });

  it('stops at the first turn that will not fit rather than skipping it', () => {
    const long = user('b', 'x'.repeat(350));
    const result = build([user('a'), long, user('c')], TURN_COST * 2);

    // Keeping 'a' by hopping over 'b' would stitch a gap into the history.
    expect(result.messages).toHaveLength(1);
    expect(result.trimmedFromId).toBe('c');
  });

  it('always puts the system prompt first', () => {
    const result = build([user('a')], 100, false, 'You are helpful');

    expect(result.messages[0]).toEqual({
      role: 'system',
      content: 'You are helpful',
    });
  });

  it('charges the system prompt to the same budget', () => {
    const system = 'y'.repeat(35);
    const result = build([user('a'), user('b')], TURN_COST * 2, false, system);

    expect(result.messages).toHaveLength(2);
    expect(result.trimmedFromId).toBe('b');
  });

  it('reports overflow when the newest turn does not fit alone', () => {
    const result = build([user('a')], 5);

    expect(result.messages).toHaveLength(0);
    expect(result.overflow).toBe(true);
    expect(result.trimmedFromId).toBeUndefined();
  });

  it('sends image parts to a vision model', () => {
    const result = build([withImage('a', 'look')], 600, true);

    const parts = partsOf(result.messages[0].content);
    expect(parts?.map(part => part.type)).toEqual(['image_url', 'text']);
  });

  it('omits an empty text part alongside an image', () => {
    const result = build([withImage('a', '')], 600, true);

    expect(partsOf(result.messages[0].content)).toHaveLength(1);
  });

  it('keeps an image-only turn as a placeholder on a text model', () => {
    const result = build([withImage('a', '')], 100);

    // Dropping it outright would delete the exchange from the history.
    expect(result.messages).toHaveLength(1);
    expect(textOf(result.messages[0].content)).toBe('[image]');
  });

  it('keeps the words when only the image is what does not fit', () => {
    const result = build([withImage('a', 'look')], 100, true);

    expect(textOf(result.messages[0].content)).toBe('[image]\nlook');
    expect(result.trimmedFromId).toBeUndefined();
  });

  it('keeps a recent image so follow-up questions still see it', () => {
    const result = build(
      [withImage('a', 'what is this'), user('b'), user('c')],
      700,
      true,
    );

    expect(result.messages).toHaveLength(3);
    expect(partsOf(result.messages[0].content)?.[0].type).toBe('image_url');
  });

  it('ignores messages with neither text nor images', () => {
    const result = build([user('a', '   '), user('b')], 100);

    expect(result.messages).toHaveLength(1);
  });
});
