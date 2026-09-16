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

  // Variants found by probing real-world shapes; each one used to fall through
  // and leave the markers on screen.
  describe('channel markers are trusted wherever they appear', () => {
    it('copes with no space after the label', () => {
      const { reasoning, content } = splitReasoning(
        '<|channel|>thoughtPlanning the reply<|channel|>Answer.',
      );
      expect(reasoning).toBe('Planning the reply');
      expect(content).toBe('Answer.');
    });

    it('copes with no label at all', () => {
      const { reasoning, content } = splitReasoning(
        '<|channel|>Some planning text<|channel|>Answer.',
      );
      expect(reasoning).toBe('Some planning text');
      expect(content).toBe('Answer.');
    });

    it('copes with a preamble before the marker', () => {
      const { content } = splitReasoning(
        'Okay, let me think about this carefully before writing anything.' +
          '<|channel|>thought plan<|channel|>Answer.',
      );
      expect(content).not.toContain('<|channel|>');
      expect(content).toContain('Answer.');
    });

    // This one bit for real: the answer-channel label was matching the bare
    // word, so a reply opening with "Answer" came back as just ".".
    it.each(['Answer', 'Final', 'Response', 'Assistant'])(
      'keeps a reply that opens with the word %s',
      word => {
        const { content } = splitReasoning(
          `<|channel|>thought plan<|channel|>${word} is 42.`,
        );
        expect(content).toBe(`${word} is 42.`);
      },
    );
    it('strips the answer label after the closing marker', () => {
      const { content } = splitReasoning(
        '<|channel|>analysis<|message|>plan<|end|>final<|message|>Answer.',
      );
      expect(content).toBe('Answer.');
    });
  });

  /**
   * Captured verbatim from a device database, not retyped from a screenshot.
   * This model half-learned its control token and emits the pipe on opposite
   * sides of the two markers -- `<|channel>` to open, `<channel|>` to close.
   * An earlier version of this file "tested" a hand-transcription that
   * normalised both to `<|channel|>`, so every case passed against text no
   * model has ever produced.
   */
  describe('real capture: himalaya gemma 4 e2b it', () => {
    const CAPTURED =
      '<|channel>thought\nThinking Process:\n\n' +
      '1.  **Analyze the Request:** The user wants me to think about Kathmandu ' +
      'and explain it in a tabular form in Nepali (nepali).\n' +
      '2.  **Identify Constraints & Persona:** I am WIMAI (Where Is My AI), a ' +
      "helpful assistant running locally on the user's device.\n" +
      '8.  **Final Output Generation.** (Proceeding to generate the response in ' +
      'Nepali tabular format.)' +
      '<channel|>काठमाडौंको बारेमा तालिका रूपमा यहाँ जानकारी दिइएको छ:\n\n' +
      '| विषय | विवरण |\n| :--- | :--- |';

    it('splits it', () => {
      const { reasoning, content } = splitReasoning(CAPTURED);
      expect(reasoning).toContain('Analyze the Request');
      expect(content).toContain('काठमाडौंको बारेमा');
    });

    it('leaves no marker on either side', () => {
      const { reasoning, content } = splitReasoning(CAPTURED);
      for (const text of [reasoning, content]) {
        expect(text).not.toContain('<|channel');
        expect(text).not.toContain('<channel');
      }
    });

    it('keeps the answer table intact', () => {
      const { content } = splitReasoning(CAPTURED);
      expect(content).toContain('| विषय | विवरण |');
    });
  });
});
