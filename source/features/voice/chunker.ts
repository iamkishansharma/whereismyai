/**
 * Splitting a streaming reply into things worth speaking.
 *
 * Pure and separate from the pipeline so the fiddly parts — abbreviations,
 * decimals, code fences — can be pinned down by tests rather than discovered
 * by listening to the assistant read a URL aloud.
 */

// The first chunk may be short: time to first sound is what the conversation
// feels like, so a three-word opener is better than waiting for a full clause.
const MIN_CHARS = 24;
// Past this, force a break at the last space. OuteTTS degrades on long inputs
// and its 4k window still has to hold a ~1k-token speaker prompt.
const MAX_CHARS = 180;

const ABBREVIATIONS = [
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'st',
  'vs',
  'etc',
  'eg',
  'ie',
  'approx',
  'no',
  'fig',
];

/**
 * Rewrite text into something worth reading aloud.
 *
 * Code and markup are described rather than pronounced — `rn-tts.cpp` will
 * cheerfully try to speak a fenced block character by character.
 */
export function sanitizeForSpeech(text: string): string {
  return (
    text
      // Fenced blocks: say what it is and move on.
      .replace(/```[\s\S]*?```/g, ' code block. ')
      .replace(/```[\s\S]*$/g, ' code block. ')
      // Inline code and emphasis markers read as noise.
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/(^|\s)[*_]([^*_]+)[*_]/g, '$1$2')
      // Links: keep the words, drop the target.
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      // Bare URLs are unlistenable.
      .replace(/https?:\/\/\S+/g, 'a link')
      // Headings and list bullets are layout, not speech.
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function endsWithAbbreviation(text: string): boolean {
  const match = /(?:^|\s)([A-Za-z.]+)\.$/.exec(text);
  if (!match) {
    return false;
  }
  const word = match[1].replace(/\./g, '').toLowerCase();
  // A single capital is an initial ("J. Smith"), not the end of a sentence.
  return word.length === 1 || ABBREVIATIONS.includes(word);
}

export interface DrainResult {
  sentences: string[];
  /** Whatever is left over, to be carried into the next call. */
  rest: string;
}

/**
 * Pull complete sentences out of a growing buffer.
 *
 * @param buffer text accumulated so far
 * @param flush true once the reply is finished, to emit the remainder
 */
export function drainSentences(buffer: string, flush = false): DrainResult {
  const sentences: string[] = [];
  let rest = buffer;

  for (;;) {
    let cut = -1;

    for (let index = 0; index < rest.length; index += 1) {
      const char = rest[index];
      if (char !== '.' && char !== '!' && char !== '?' && char !== '…') {
        continue;
      }

      const next = rest[index + 1];
      // A terminator only ends a sentence if something separates it from what
      // follows; "3.14" and "example.com" must survive intact.
      if (next !== undefined && next !== ' ' && next !== '\n') {
        continue;
      }
      if (char === '.' && endsWithAbbreviation(rest.slice(0, index + 1))) {
        continue;
      }

      const candidate = rest.slice(0, index + 1).trim();
      if (candidate.length < MIN_CHARS && next !== undefined) {
        // Too short to stand alone — keep going and let it merge upward.
        continue;
      }

      cut = index + 1;
      break;
    }

    if (cut === -1) {
      // No natural break, but the buffer is too long to keep holding.
      if (rest.length > MAX_CHARS) {
        const forced = rest.lastIndexOf(' ', MAX_CHARS);
        const at = forced > MIN_CHARS ? forced : MAX_CHARS;
        sentences.push(rest.slice(0, at).trim());
        rest = rest.slice(at);
        continue;
      }
      break;
    }

    sentences.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut);
  }

  if (flush) {
    const remainder = rest.trim();
    if (remainder) {
      sentences.push(remainder);
      rest = '';
    }
  }

  return { sentences: sentences.filter(Boolean), rest };
}
