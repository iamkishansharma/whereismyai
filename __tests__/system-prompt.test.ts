import {
  DEFAULT_SYSTEM_PROMPT,
  MINIMAL_SYSTEM_PROMPT,
  systemPromptFor,
} from '@/features/models/constants';

const MB = 1024 * 1024;

describe('systemPromptFor', () => {
  it('gives the smallest models an identity and nothing else', () => {
    // SmolLM2 135M (105MB) and LFM2 350M (219MB) both continue a long prompt
    // instead of following it.
    expect(systemPromptFor(105 * MB)).toBe(MINIMAL_SYSTEM_PROMPT);
    expect(systemPromptFor(219 * MB)).toBe(MINIMAL_SYSTEM_PROMPT);
  });

  it('gives half a billion parameters and up the full instructions', () => {
    expect(systemPromptFor(469 * MB)).toBe(DEFAULT_SYSTEM_PROMPT);
    expect(systemPromptFor(2 * 1024 * MB)).toBe(DEFAULT_SYSTEM_PROMPT);
  });

  it('falls back to the full prompt when the size is unknown', () => {
    expect(systemPromptFor(0)).toBe(DEFAULT_SYSTEM_PROMPT);
  });

  it('names the assistant in both prompts', () => {
    expect(MINIMAL_SYSTEM_PROMPT).toContain('WIMAI');
    expect(DEFAULT_SYSTEM_PROMPT).toContain('WIMAI');
  });

  it('keeps the minimal prompt genuinely short', () => {
    // The whole point is leaving little to imitate; a paragraph would defeat it.
    expect(MINIMAL_SYSTEM_PROMPT.length).toBeLessThan(90);
  });
});
