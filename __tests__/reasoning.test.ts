import { splitReasoning } from '@/core/llama/reasoning';

describe('splitReasoning', () => {
  it('leaves an ordinary reply completely alone', () => {
    const plain = 'The capital of Nepal is Kathmandu.';
    expect(splitReasoning(plain)).toEqual({ reasoning: '', content: plain });
  });

  it('pulls apart a <think> block', () => {
    const { reasoning, content } = splitReasoning(
      '<think>The user wants a capital city. Nepal -> Kathmandu.</think>Kathmandu.',
    );
    expect(reasoning).toBe(
      'The user wants a capital city. Nepal -> Kathmandu.',
    );
    expect(content).toBe('Kathmandu.');
  });

  it.each(['thinking', 'reasoning'])('handles <%s> too', tag => {
    const { reasoning, content } = splitReasoning(
      `<${tag}>weighing it up</${tag}>Done.`,
    );
    expect(reasoning).toBe('weighing it up');
    expect(content).toBe('Done.');
  });

  // Verbatim from the bug report: a Gemma fine-tune that opens a channel for
  // its monologue and switches channel for the answer, never closing either.
  it('splits the channel format that prompted this', () => {
    const { reasoning, content } = splitReasoning(
      '<|channel|>thought Thinking Process:\n' +
        '1. Analyze the Request: The user asked for "a poem in nepali."\n' +
        '2. Determine Capability: I can generate text in Nepali.\n' +
        '(Initial thought draft structure seems okay for a general request.)' +
        '<|channel|>यहाँ तपाईंको लागि एउटा कविता प्रस्तुत छ:',
    );
    expect(reasoning).toContain('Analyze the Request');
    expect(reasoning).not.toContain('<|channel|>');
    expect(content).toBe('यहाँ तपाईंको लागि एउटा कविता प्रस्तुत छ:');
  });

  it('splits harmony analysis channels', () => {
    const { reasoning, content } = splitReasoning(
      '<|channel|>analysis<|message|>Let me check the arithmetic.<|end|>It is 42.',
    );
    expect(reasoning).toBe('Let me check the arithmetic.');
    expect(content).toBe('It is 42.');
  });

  describe('while the reply is still streaming', () => {
    it('treats an unclosed block as reasoning so far, with no answer yet', () => {
      const { reasoning, content } = splitReasoning(
        '<think>Still working through the first ste',
      );
      expect(reasoning).toBe('Still working through the first ste');
      expect(content).toBe('');
    });

    it('moves text into the answer once the block closes', () => {
      const { reasoning, content } = splitReasoning(
        '<think>Nepal -> Kathmandu.</think>Kath',
      );
      expect(reasoning).toBe('Nepal -> Kathmandu.');
      expect(content).toBe('Kath');
    });
  });

  // The failure that would matter: swallowing an answer that merely talks
  // about these tags. Leaking a marker is recoverable; losing text is not.
  describe('does not eat real content', () => {
    it('ignores a tag that appears mid-answer', () => {
      const answer =
        'Reasoning models wrap their scratchpad in <think> tags like this.';
      expect(splitReasoning(answer)).toEqual({
        reasoning: '',
        content: answer,
      });
    });

    it('keeps prose that precedes an opening tag', () => {
      const { content } = splitReasoning('Sure.<think>hmm</think>Kathmandu.');
      expect(content).toBe('Sure.Kathmandu.');
    });

    it('returns empty for empty input', () => {
      expect(splitReasoning('')).toEqual({ reasoning: '', content: '' });
    });
  });
});
