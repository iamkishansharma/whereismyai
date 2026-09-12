import { and, desc, eq, like, sql } from 'drizzle-orm';

import { db } from './client';
import { conversations, messages } from './schema';
import { buildSnippet, toLikePattern, toTerms } from './search-text';

export interface SearchHit {
  messageId: string;
  conversationId: string;
  conversationTitle: string;
  role: 'user' | 'assistant' | 'system';
  createdAt: number;
  /** Surrounding words with each match wrapped in «…», ready to highlight. */
  snippet: string;
}

const LIMIT = 50;

/**
 * Searches message bodies with `LIKE`.
 *
 * A full scan rather than an index: a phone's history is thousands of rows, not
 * millions, so this costs milliseconds and the caller already debounces. It
 * buys portability — an FTS5 index would need a native build flag that is off
 * by default, and a missing flag is not something a search feature should be
 * able to fail the whole app over.
 */
export async function searchMessages(input: string): Promise<SearchHit[]> {
  const terms = toTerms(input);
  if (!terms.length) {
    return [];
  }

  const rows = await db
    .select({
      messageId: messages.id,
      conversationId: messages.conversationId,
      conversationTitle: conversations.title,
      role: messages.role,
      createdAt: messages.createdAt,
      content: messages.content,
    })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(
      and(
        // Every term must appear, so adding words narrows the result.
        ...terms.map(term =>
          like(messages.content, sql`${toLikePattern(term)} ESCAPE '\\'`),
        ),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(LIMIT);

  return rows.map(row => ({
    messageId: row.messageId,
    conversationId: row.conversationId,
    conversationTitle: row.conversationTitle,
    role: row.role,
    createdAt: row.createdAt,
    snippet: buildSnippet(row.content, terms),
  }));
}
