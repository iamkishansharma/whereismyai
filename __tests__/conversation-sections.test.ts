import dayjs from 'dayjs';

import {
  groupByDay,
  sectionTitle,
  timeLabel,
} from '@/features/chat/conversation-sections';
import type { Conversation } from '@/types';

const NOW = dayjs('2026-08-08T15:00:00').valueOf();

const at = (iso: string): number => dayjs(iso).valueOf();

const conversation = (id: string, iso: string, title = id): Conversation => ({
  id,
  title,
  createdAt: at(iso),
  updatedAt: at(iso),
  messageIds: [],
});

describe('sectionTitle', () => {
  it('names today and yesterday', () => {
    expect(sectionTitle(at('2026-08-08T09:00:00'), NOW)).toBe('Today');
    expect(sectionTitle(at('2026-08-07T23:59:00'), NOW)).toBe('Yesterday');
  });

  it('dates anything older in full', () => {
    expect(sectionTitle(at('2026-08-06T12:30:00'), NOW)).toBe('Aug 6 2026');
    expect(sectionTitle(at('2025-12-31T12:30:00'), NOW)).toBe('Dec 31 2025');
  });

  it('uses the calendar day, not a 24-hour window', () => {
    // 00:30 today is under an hour before 23:50 yesterday, but they are
    // different days and must not share a header.
    const justAfterMidnight = at('2026-08-08T00:30:00');
    const lateYesterday = at('2026-08-07T23:50:00');

    expect(sectionTitle(justAfterMidnight, NOW)).toBe('Today');
    expect(sectionTitle(lateYesterday, NOW)).toBe('Yesterday');
  });
});

describe('timeLabel', () => {
  it('formats as 12-hour with a meridiem', () => {
    expect(timeLabel(at('2026-08-06T12:30:00'))).toBe('12:30 PM');
    expect(timeLabel(at('2026-08-06T00:05:00'))).toBe('12:05 AM');
    expect(timeLabel(at('2026-08-06T09:07:00'))).toBe('9:07 AM');
  });
});

describe('groupByDay', () => {
  it('buckets conversations under one header per day', () => {
    const sections = groupByDay(
      [
        conversation('a', '2026-08-08T10:00:00'),
        conversation('b', '2026-08-08T08:00:00'),
        conversation('c', '2026-08-06T12:30:00'),
      ],
      NOW,
    );

    expect(sections.map(section => section.title)).toEqual([
      'Today',
      'Aug 6 2026',
    ]);
    expect(sections[0].data.map(item => item.id)).toEqual(['a', 'b']);
  });

  it('orders newest first, within sections and across them', () => {
    const sections = groupByDay(
      [
        conversation('old', '2026-08-06T12:30:00'),
        conversation('newest', '2026-08-08T14:00:00'),
        conversation('middle', '2026-08-08T09:00:00'),
      ],
      NOW,
    );

    expect(sections[0].data.map(item => item.id)).toEqual(['newest', 'middle']);
    expect(sections[1].data.map(item => item.id)).toEqual(['old']);
  });

  it('carries the time for each row', () => {
    const sections = groupByDay(
      [conversation('a', '2026-08-06T12:30:00')],
      NOW,
    );

    expect(sections[0].data[0].time).toBe('12:30 PM');
  });

  it('keys sections by day so they stay stable across renders', () => {
    const first = groupByDay([conversation('a', '2026-08-06T12:30:00')], NOW);
    const second = groupByDay([conversation('a', '2026-08-06T18:00:00')], NOW);

    expect(first[0].key).toBe(second[0].key);
  });

  it('returns nothing for an empty history', () => {
    expect(groupByDay([], NOW)).toEqual([]);
  });
});
