import { asc, desc, eq, inArray } from 'drizzle-orm';

import type {
  Attachment,
  Conversation,
  Message,
  MessageStatus,
} from '@/types';
import { db } from './client';
import { attachments, conversations, messages } from './schema';
import type { AttachmentRow, ConversationRow, MessageRow } from './schema';

export interface ChatSnapshot {
  conversations: Record<string, Conversation>;
  conversationOrder: string[];
  messages: Record<string, Message>;
}

function toMessage(row: MessageRow, files: Attachment[]): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt,
    status: row.status,
    error: row.error ?? undefined,
    modelId: row.modelId ?? undefined,
    attachments: files.length ? files : undefined,
  };
}

function toAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    messageId: row.messageId,
    kind: row.kind,
    uri: row.uri,
    mimeType: row.mimeType ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    sizeBytes: row.sizeBytes ?? undefined,
  };
}

function toConversation(row: ConversationRow, messageIds: string[]): Conversation {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    modelId: row.modelId ?? undefined,
    systemPrompt: row.systemPrompt ?? undefined,
    messageIds,
  };
}

export async function loadChatSnapshot(): Promise<ChatSnapshot> {
  const [conversationRows, messageRows, attachmentRows] = await Promise.all([
    db.select().from(conversations).orderBy(desc(conversations.updatedAt)),
    db.select().from(messages).orderBy(asc(messages.createdAt)),
    db.select().from(attachments),
  ]);

  const filesByMessage = new Map<string, Attachment[]>();
  for (const row of attachmentRows) {
    const list = filesByMessage.get(row.messageId) ?? [];
    list.push(toAttachment(row));
    filesByMessage.set(row.messageId, list);
  }

  const idsByConversation = new Map<string, string[]>();
  const messageMap: Record<string, Message> = {};

  for (const row of messageRows) {
    messageMap[row.id] = toMessage(row, filesByMessage.get(row.id) ?? []);
    const list = idsByConversation.get(row.conversationId) ?? [];
    list.push(row.id);
    idsByConversation.set(row.conversationId, list);
  }

  const conversationMap: Record<string, Conversation> = {};
  const order: string[] = [];

  for (const row of conversationRows) {
    conversationMap[row.id] = toConversation(
      row,
      idsByConversation.get(row.id) ?? [],
    );
    order.push(row.id);
  }

  return {
    conversations: conversationMap,
    conversationOrder: order,
    messages: messageMap,
  };
}

export async function insertConversation(
  conversation: Conversation,
): Promise<void> {
  await db.insert(conversations).values({
    id: conversation.id,
    title: conversation.title,
    modelId: conversation.modelId ?? null,
    systemPrompt: conversation.systemPrompt ?? null,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  });
}

export async function updateConversation(
  conversationId: string,
  patch: Partial<Pick<Conversation, 'title' | 'updatedAt' | 'modelId' | 'systemPrompt'>>,
): Promise<void> {
  await db
    .update(conversations)
    .set({
      ...(patch.title !== undefined ? { title: patch.title } : null),
      ...(patch.updatedAt !== undefined ? { updatedAt: patch.updatedAt } : null),
      ...(patch.modelId !== undefined ? { modelId: patch.modelId ?? null } : null),
      ...(patch.systemPrompt !== undefined
        ? { systemPrompt: patch.systemPrompt ?? null }
        : null),
    })
    .where(eq(conversations.id, conversationId));
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await db.delete(conversations).where(eq(conversations.id, conversationId));
}

export async function insertMessage(message: Message): Promise<void> {
  await db.insert(messages).values({
    id: message.id,
    conversationId: message.conversationId,
    role: message.role,
    content: message.content,
    status: message.status,
    error: message.error ?? null,
    modelId: message.modelId ?? null,
    createdAt: message.createdAt,
  });

  if (message.attachments?.length) {
    await db.insert(attachments).values(
      message.attachments.map(file => ({
        id: file.id,
        messageId: message.id,
        kind: file.kind,
        uri: file.uri,
        mimeType: file.mimeType ?? null,
        width: file.width ?? null,
        height: file.height ?? null,
        sizeBytes: file.sizeBytes ?? null,
      })),
    );
  }
}

export async function updateMessage(
  messageId: string,
  patch: { content?: string; status?: MessageStatus; error?: string },
): Promise<void> {
  await db
    .update(messages)
    .set({
      ...(patch.content !== undefined ? { content: patch.content } : null),
      ...(patch.status !== undefined ? { status: patch.status } : null),
      ...(patch.error !== undefined ? { error: patch.error ?? null } : null),
    })
    .where(eq(messages.id, messageId));
}

export async function deleteMessages(messageIds: string[]): Promise<void> {
  if (!messageIds.length) {
    return;
  }
  await db.delete(messages).where(inArray(messages.id, messageIds));
}

export async function resetStreamingMessages(): Promise<void> {
  await db
    .update(messages)
    .set({ status: 'stopped' })
    .where(eq(messages.status, 'streaming'));
}
