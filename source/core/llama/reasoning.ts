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
  /**
   * Control tokens like `<|channel|>` cannot appear in ordinary prose, so they
   * are trusted wherever they turn up. An XML-ish `<think>` can appear in a
   * real answer, so it is only believed at the very start of a reply.
   */
  anywhere?: boolean;
}

/**
 * A control token, tolerating a half-learned one.
 *
 * A fine-tune was observed emitting `<|channel>` to open its monologue and
 * `<channel|>` to close it — the pipe on opposite sides within a single reply.
 * So the pipe may sit either side, but at least one must be there: a bare
 * `<channel>` is plausible prose, and these markers are trusted anywhere in a
 * reply rather than only at the start.
 */
const token = (names: string) => `<(?:\\|(?:${names})\\|?|(?:${names})\\|)>`;

// Labels a model puts straight after a channel marker. Optional: some emit
// `<|channel|>thought`, others just open a channel and start writing.
const THINKING_LABEL =
  /(?:analysis|thought(?:s)?|thinking|reasoning|scratchpad)?/.source;
/**
 * A channel label only counts as a label when a control token follows it.
 * Matching the bare word would swallow the first word of any reply that
 * happens to open with "Answer" or "Final" — which it did, until it didn't.
 */
const ANSWER_LABEL = new RegExp(
  `^[ \\t]*(?:final|assistant|response|answer)?[ \\t]*${token('message')}`,
  'i',
);

const MARKERS: Marker[] = [
  // gpt-oss / harmony and the fine-tunes that borrow its shape.
  {
    open: new RegExp(
      `${token('channel')}[ \\t]*${THINKING_LABEL}[ \\t]*(?:${token(
        'message',
      )})?`,
      'i',
    ),
    close: new RegExp(token('end|return|start|channel'), 'i'),
    anywhere: true,
  },
  { open: /<think>/i, close: /<\/think>/i },
  { open: /<thinking>/i, close: /<\/thinking>/i },
  { open: /<reasoning>/i, close: /<\/reasoning>/i },
];

/**
 * How far into a reply an ambiguous opening tag is still believed. A model
 * that mentions `<think>` halfway through an answer is talking about tags,
 * not using them, and swallowing that text would be far worse than leaving a
 * marker on screen.
 */
const LEADING_SLACK = 40;

export function splitReasoning(raw: string): SplitReply {
  if (!raw) {
    return { reasoning: '', content: '' };
  }

  for (const marker of MARKERS) {
    const opened = marker.open.exec(raw);
    if (!opened) {
      continue;
    }
    if (!marker.anywhere && opened.index > LEADING_SLACK) {
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
    // Drop the answer channel's own label, but only when it is punctuated as
    // one — see ANSWER_LABEL.
    const after = rest
      .slice(closed.index + closed[0].length)
      .replace(ANSWER_LABEL, '');

    return {
      reasoning: rest.slice(0, closed.index).trim(),
      content: `${before}${after}`.trim(),
    };
  }

  return { reasoning: '', content: raw };
}
