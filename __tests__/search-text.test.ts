import {
  buildSnippet,
  MARK_CLOSE,
  MARK_OPEN,
  toLikePattern,
  toTerms,
} from '@/core/db/search-text';

const mark = (text: string) => `${MARK_OPEN}${text}${MARK_CLOSE}`;

describe('toTerms', () => {
  it('splits on whitespace and drops the empties', () => {
    expect(toTerms('  quick   brown  ')).toEqual(['quick', 'brown']);
  });

  it('is empty for blank input', () => {
    expect(toTerms('   ')).toEqual([]);
  });

  it('strips the highlight markers so a query cannot forge one', () => {
    expect(toTerms(`${MARK_OPEN}fake${MARK_CLOSE}`)).toEqual(['fake']);
  });
});

describe('toLikePattern', () => {
  it('matches the term anywhere', () => {
    expect(toLikePattern('fox')).toBe('%fox%');
  });

  it('escapes % so it is a literal, not "match everything"', () => {
    expect(toLikePattern('100%')).toBe('%100\\%%');
  });

  it('escapes _ so it is a literal, not "any character"', () => {
    expect(toLikePattern('a_b')).toBe('%a\\_b%');
  });

  it('escapes the escape character itself', () => {
    expect(toLikePattern('a\\b')).toBe('%a\\\\b%');
  });
});

describe('buildSnippet', () => {
  it('marks the match', () => {
    expect(buildSnippet('the quick brown fox', ['brown'])).toBe(
      `the quick ${mark('brown')} fox`,
    );
  });

  it('marks every occurrence, not just the first', () => {
    const snippet = buildSnippet('fox and fox', ['fox']);
    expect(snippet.split(MARK_OPEN)).toHaveLength(3);
  });

  it('matches case-insensitively but keeps the original casing', () => {
    expect(buildSnippet('The Quick Fox', ['quick'])).toContain(mark('Quick'));
  });

  it('marks each term of a multi-word query', () => {
    const snippet = buildSnippet('the quick brown fox', ['quick', 'fox']);
    expect(snippet).toContain(mark('quick'));
    expect(snippet).toContain(mark('fox'));
  });

  it('centres on the match and ellipsises what it cut', () => {
    const content = `${'a '.repeat(80)}needle${' b'.repeat(80)}`;
    const snippet = buildSnippet(content, ['needle']);

    expect(snippet).toContain(mark('needle'));
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
    expect(snippet.length).toBeLessThan(content.length);
  });

  it('does not add a leading ellipsis when the match is at the start', () => {
    expect(buildSnippet('needle in there', ['needle']).startsWith('…')).toBe(
      false,
    );
  });

  it('collapses newlines so a snippet stays one line', () => {
    expect(buildSnippet('a\n\nb needle', ['needle'])).toBe(
      `a b ${mark('needle')}`,
    );
  });

  it('falls back to a leading excerpt when no term is present', () => {
    // The row can match on content that changed between query and render.
    expect(buildSnippet('nothing relevant here', ['zzz'])).toBe(
      'nothing relevant here',
    );
  });
});
