import { drainSentences, sanitizeForSpeech } from '@/features/voice/chunker';

describe('sanitizeForSpeech', () => {
  it('replaces fenced code with a description', () => {
    const out = sanitizeForSpeech('Try this:\n```js\nconst a = 1;\n```\nDone.');
    expect(out).toContain('code block');
    expect(out).not.toContain('const');
  });

  it('handles an unterminated fence from a partial stream', () => {
    const out = sanitizeForSpeech('Here:\n```js\nconst a = 1;');
    expect(out).toContain('code block');
    expect(out).not.toContain('const');
  });

  it('keeps link text and drops the target', () => {
    expect(sanitizeForSpeech('See [the docs](https://x.com/y)')).toBe(
      'See the docs',
    );
  });

  it('reads a bare URL as a link rather than spelling it', () => {
    expect(sanitizeForSpeech('Go to https://example.com/a?b=1 now')).toBe(
      'Go to a link now',
    );
  });

  it('strips emphasis, headings and bullets', () => {
    expect(sanitizeForSpeech('## Title\n- **bold** item')).toBe(
      'Title bold item',
    );
  });
});

describe('drainSentences', () => {
  it('emits nothing until a sentence is complete', () => {
    const { sentences, rest } = drainSentences('This is an unfinished thought');
    expect(sentences).toEqual([]);
    expect(rest).toBe('This is an unfinished thought');
  });

  it('emits a sentence once it terminates and carries the remainder', () => {
    const { sentences, rest } = drainSentences(
      'The first sentence is here. And the sec',
    );
    expect(sentences).toEqual(['The first sentence is here.']);
    expect(rest.trim()).toBe('And the sec');
  });

  it('does not break inside a decimal number', () => {
    const { sentences } = drainSentences(
      'The value of pi is 3.14 and that matters here. ',
    );
    expect(sentences).toEqual([
      'The value of pi is 3.14 and that matters here.',
    ]);
  });

  it('does not break after a known abbreviation', () => {
    const { sentences } = drainSentences(
      'We met Dr. Smith at the conference today. ',
    );
    expect(sentences).toEqual(['We met Dr. Smith at the conference today.']);
  });

  it('does not break after a single initial', () => {
    const { sentences } = drainSentences(
      'The author is J. Smith and he wrote it. ',
    );
    expect(sentences).toEqual(['The author is J. Smith and he wrote it.']);
  });

  it('merges a very short opener into the next sentence', () => {
    // "Sure." alone is under the minimum, so it waits for more.
    const { sentences } = drainSentences('Sure. That is a longer follow up. ');
    expect(sentences).toEqual(['Sure. That is a longer follow up.']);
  });

  it('forces a break when no terminator arrives', () => {
    const long = `${'word '.repeat(60)}`;
    const { sentences } = drainSentences(long);
    expect(sentences.length).toBeGreaterThan(0);
    expect(sentences[0].length).toBeLessThanOrEqual(180);
  });

  it('emits the remainder on flush', () => {
    const { sentences, rest } = drainSentences('No terminator here', true);
    expect(sentences).toEqual(['No terminator here']);
    expect(rest).toBe('');
  });

  it('handles several sentences in one go', () => {
    const { sentences } = drainSentences(
      'The first one is long enough. The second one is also long enough. ',
    );
    expect(sentences).toHaveLength(2);
  });

  it('never emits empty strings', () => {
    const { sentences } = drainSentences('...   ', true);
    expect(sentences.every(Boolean)).toBe(true);
  });
});
