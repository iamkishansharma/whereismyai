import dayjs from 'dayjs';

import type { Conversation } from '@/types';

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
  /** Wall-clock time of the last message, e.g. "12:30 PM". */
  time: string;
}

export interface ConversationSection {
  /** Start-of-day timestamp — stable across renders within the same day. */
  key: string;
  title: string;
  data: ConversationSummary[];
}

/**
 * "Today" and "Yesterday" read faster than a date, but only for the two days
 * where they are unambiguous. Everything older is dated in full rather than
 * relatively — "3 days ago" makes the reader do arithmetic.
 */
export function sectionTitle(timestamp: number, now: number): string {
  const day = dayjs(timestamp);
  const today = dayjs(now);

  if (day.isSame(today, 'day')) {
    return 'Today';
  }
  if (day.isSame(today.subtract(1, 'day'), 'day')) {
    return 'Yesterday';
  }
  return day.format('MMM D YYYY');
}

export function timeLabel(timestamp: number): string {
  return dayjs(timestamp).format('h:mm A');
}

/**
 * Groups conversations into day sections, newest first.
 *
 * Sorting here rather than trusting the caller keeps the list correct when a
 * conversation is renamed or receives a reply, both of which move it.
 */
export function groupByDay(
  conversations: Conversation[],
  now: number,
): ConversationSection[] {
  const sections: ConversationSection[] = [];
  let current: ConversationSection | undefined;

  const ordered = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  for (const conversation of ordered) {
    const key = String(dayjs(conversation.updatedAt).startOf('day').valueOf());

    if (!current || current.key !== key) {
      current = {
        key,
        title: sectionTitle(conversation.updatedAt, now),
        data: [],
      };
      sections.push(current);
    }

    current.data.push({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
      time: timeLabel(conversation.updatedAt),
    });
  }

  return sections;
}
