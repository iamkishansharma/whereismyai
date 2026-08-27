import { answeringImages, historyFor } from '@/features/chat/prompt';
import type { Attachment, Conversation, Message } from '@/types';

const message = (id: string, files?: Attachment[]): Message => ({
  id,
  conversationId: 'c1',
  role: 'user',
  content: `body of ${id}`,
  createdAt: 0,
  status: 'sent',
  attachments: files,
});

const image = (id: string): Attachment => ({
  id,
  messageId: 'ignored',
  kind: 'image',
  uri: `file:///${id}.jpg`,
});

const conversation = (messageIds: string[]): Conversation => ({
  id: 'c1',
  title: 'test',
  createdAt: 0,
  updatedAt: 0,
  messageIds,
});

const byId = (...items: Message[]): Record<string, Message> =>
  Object.fromEntries(items.map(item => [item.id, item]));

describe('historyFor', () => {
  it('keeps conversation order and drops the reply placeholder', () => {
    const history = historyFor(
      conversation(['a', 'b', 'reply']),
      byId(message('a'), message('b'), message('reply')),
      'reply',
    );

    expect(history.map(m => m.id)).toEqual(['a', 'b']);
  });

  it('skips ids with no message rather than yielding holes', () => {
    const history = historyFor(
      conversation(['a', 'missing', 'b']),
      byId(message('a'), message('b')),
      'reply',
    );

    expect(history.map(m => m.id)).toEqual(['a', 'b']);
  });

  it('returns nothing for an unknown conversation', () => {
    expect(historyFor(undefined, {}, 'reply')).toEqual([]);
  });
});

describe('answeringImages', () => {
  it('is true when the turn being answered carries an image', () => {
    expect(answeringImages([message('a'), message('b', [image('i1')])])).toBe(
      true,
    );
  });

  it('is false when only an older turn carried one', () => {
    // The guard must not latch: one old image used to block every later send
    // after switching to a text-only model.
    expect(answeringImages([message('a', [image('i1')]), message('b')])).toBe(
      false,
    );
  });

  it('is false for an empty history', () => {
    expect(answeringImages([])).toBe(false);
  });
});
