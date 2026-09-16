/**
 * Reasoning models narrate before they answer and mark that narration with
 * tags the user was never meant to read. llama.cpp strips the formats it
 * recognises, but only when the model's template declares them — a fine-tune
 * that invents its own leaks them into the transcript.
 *
 * Splitting here, on the raw stored text at render time, keeps the message as
 * the model wrote it and fixes replies already in the database.
 */

export interface SplitReply {
  reasoning: string;
  content: string;
}

interface Marker {
  open: RegExp;
  close: RegExp;
  /** Control tokens cannot occur in prose, so they are trusted anywhere. */
  anywhere?: boolean;
}

/**
 * A control token, tolerating a half-learned one: a fine-tune was seen opening
 * with `<|channel>` and closing with `<channel|>` in the same reply. At least
 * one pipe is required — a bare `<channel>` is plausible prose.
 */
const token = (names: string) => `<(?:\\|(?:${names})\\|?|(?:${names})\\|)>`;

const THINKING_LABEL =
  /(?:analysis|thought(?:s)?|thinking|reasoning|scratchpad)?/.source;

/** Only a label when a control token follows; the bare word is someone's answer. */
const ANSWER_LABEL = new RegExp(
  `^[ \\t]*(?:final|assistant|response|answer)?[ \\t]*${token('message')}`,
  'i',
);

const MARKERS: Marker[] = [
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

/** How far in an ambiguous tag is still believed — past this it is prose. */
const LEADING_SLACK = 40;

export function splitReasoning(raw: string): SplitReply {
  if (!raw) {
    return { reasoning: '', content: '' };
  }

  for (const marker of MARKERS) {
    const opened = marker.open.exec(raw);
    if (!opened || (!marker.anywhere && opened.index > LEADING_SLACK)) {
      continue;
    }

    const rest = raw.slice(opened.index + opened[0].length);
    const closed = marker.close.exec(rest);

    // Unclosed is the normal mid-stream state, and where Stop leaves things.
    if (!closed) {
      return { reasoning: rest.trim(), content: '' };
    }

    const before = raw.slice(0, opened.index);
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
