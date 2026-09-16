/**
 * Reasoning models narrate before they answer, and they mark that narration
 * with tags the user was never meant to read. llama.cpp strips the formats it
 * recognises, but only for models whose template declares them — a fine-tune
 * that invents its own markers leaks them into the transcript.
 *
 * So the split happens here, on the raw text, at render time. That keeps the
 * stored message exactly as the model produced it, and means replies already
 * sitting in someone's database start rendering correctly rather than staying
 * broken forever.
 */

export interface SplitReply {
  /** The narration, if any. Never shown inline — it belongs in its own block. */
  reasoning: string;
  /** What the user actually asked for. */
  content: string;
}

interface Marker {
  open: RegExp;
  /**
   * What ends the block. Some models close with a matching tag; the harmony
   * family switches channel instead, so the "close" is the next marker.
   */
  close: RegExp;
}

// Ordered most-specific first: `<|channel|>` variants have to be tried before
// anything that would match a bare tag inside them.
const MARKERS: Marker[] = [
  // gpt-oss / harmony: <|channel|>analysis<|message|> … <|end|> or <|start|>
  {
    open: /<\|channel\|>\s*(?:analysis|thought|thinking|reasoning)\b[^]*?(?:<\|message\|>)?/i,
    close: /<\|(?:end|return|start|channel)\|>/i,
  },
  { open: /<think>/i, close: /<\/think>/i },
  { open: /<thinking>/i, close: /<\/thinking>/i },
  { open: /<reasoning>/i, close: /<\/reasoning>/i },
];

/**
 * Only treat a block as reasoning when it opens at the very start of the
 * reply. A model that mentions `<think>` halfway through an answer is talking
 * about tags, not using them, and swallowing that text would be far worse
 * than leaving a marker on screen.
 */
const LEADING_SLACK = 40;

export function splitReasoning(raw: string): SplitReply {
  if (!raw) {
    return { reasoning: '', content: '' };
  }

  for (const marker of MARKERS) {
    const opened = marker.open.exec(raw);
    if (!opened || opened.index > LEADING_SLACK) {
      continue;
    }

    const bodyStart = opened.index + opened[0].length;
    const rest = raw.slice(bodyStart);
    const closed = marker.close.exec(rest);

    // No closing marker yet. Mid-stream that is simply where the model has got
    // to; after a Stop it is where it was interrupted. Either way everything
    // so far is narration, and there is no answer to show.
    if (!closed) {
      return { reasoning: rest.trim(), content: '' };
    }

    const before = raw.slice(0, opened.index);
    const after = rest.slice(closed.index + closed[0].length);

    return {
      reasoning: rest.slice(0, closed.index).trim(),
      content: `${before}${after}`.trim(),
    };
  }

  return { reasoning: '', content: raw };
}
