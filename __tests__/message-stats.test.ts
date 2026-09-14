import { describeStats } from '@/features/chat/components/message-stats';
import type { GenerationStats } from '@/types';

const stats = (patch: Partial<GenerationStats> = {}): GenerationStats => ({
  tokensPredicted: 340,
  tokensEvaluated: 120,
  tokensPerSecond: 12.37,
  msToFirstToken: 800,
  totalMs: 27500,
  ...patch,
});

describe('describeStats', () => {
  it('leads with tokens, then speed, then how long it took', () => {
    expect(describeStats(stats())).toBe('340 tokens · 12.4 tok/s · 27.5s');
  });

  it('uses milliseconds below a second', () => {
    expect(describeStats(stats({ totalMs: 420 }))).toContain('420ms');
  });

  it('switches to minutes so nobody reads "142.8s"', () => {
    expect(describeStats(stats({ totalMs: 142_800 }))).toContain('2m 23s');
  });

  it('omits a speed the model never reported', () => {
    // A cancelled reply has tokens but no meaningful rate; claiming 0 tok/s
    // would be worse than saying nothing.
    expect(describeStats(stats({ tokensPerSecond: 0 }))).toBe(
      '340 tokens · 27.5s',
    );
  });

  it('survives a reply with no timing at all', () => {
    expect(describeStats(stats({ tokensPerSecond: 0, totalMs: 0 }))).toBe(
      '340 tokens',
    );
  });
});
