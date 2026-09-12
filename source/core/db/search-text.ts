/** Wraps a match so the UI can highlight it without re-finding the term. */
export const MARK_OPEN = '«';
export const MARK_CLOSE = '»';

const ESCAPE = '\\';
/** Characters either side of the first match, before ellipsising. */
const WINDOW = 40;

/**
 * Splits input into the terms a search should require.
 *
 * The markers are stripped so a query cannot forge a highlight, and empty
 * pieces are dropped so trailing spaces don't produce a term that matches
 * everything.
 */
export function toTerms(input: string): string[] {
  return input
    .trim()
    .split(/\s+/)
    .map(term => term.split(MARK_OPEN).join('').split(MARK_CLOSE).join(''))
    .filter(Boolean);
}

/**
 * A `LIKE` pattern that matches the term anywhere.
 *
 * `%` and `_` are wildcards in SQL, so an unescaped query of "100%" would match
 * every message and "a_b" would match "axb". Must be used with `ESCAPE '\'`.
 */
export function toLikePattern(term: string): string {
  const escaped = term
    .split(ESCAPE)
    .join(ESCAPE + ESCAPE)
    .split('%')
    .join(ESCAPE + '%')
    .split('_')
    .join(ESCAPE + '_');

  return `%${escaped}%`;
}

function indexOfTerm(content: string, term: string): number {
  return content.toLowerCase().indexOf(term.toLowerCase());
}

/**
 * An excerpt centred on the first match, with every occurrence marked.
 *
 * This is the work SQLite's `snippet()` used to do. Terms are matched
 * case-insensitively but the original casing is preserved in the output.
 */
export function buildSnippet(content: string, terms: string[]): string {
  const collapsed = content.replace(/\s+/g, ' ').trim();

  const firstAt = terms
    .map(term => indexOfTerm(collapsed, term))
    .filter(at => at !== -1)
    .sort((a, b) => a - b)[0];

  // No term present — the row matched on another field, or the content changed
  // between query and render. A leading excerpt still tells the reader what
  // this message is.
  const start = firstAt === undefined ? 0 : Math.max(0, firstAt - WINDOW);
  const end = Math.min(
    collapsed.length,
    (firstAt === undefined ? 0 : firstAt) + WINDOW * 2,
  );

  let excerpt = collapsed.slice(start, end);

  for (const term of terms) {
    if (!term) {
      continue;
    }
    const lower = excerpt.toLowerCase();
    const needle = term.toLowerCase();
    let out = '';
    let cursor = 0;

    for (;;) {
      const at = lower.indexOf(needle, cursor);
      if (at === -1) {
        out += excerpt.slice(cursor);
        break;
      }
      out += excerpt.slice(cursor, at);
      out += MARK_OPEN + excerpt.slice(at, at + term.length) + MARK_CLOSE;
      cursor = at + term.length;
    }
    excerpt = out;
  }

  return [
    start > 0 ? '…' : '',
    excerpt,
    end < collapsed.length ? '…' : '',
  ].join('');
}
