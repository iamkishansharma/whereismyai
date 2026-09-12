import { asc, desc, eq } from 'drizzle-orm';

import { toFileUrl, toRelative } from '@/core/paths';
import type {
  Attachment,
  Conversation,
  GenerationStats,
  Message,
  MessageStatus,
} from '@/types';
import { atomically, db } from './client';
import { attachments, conversations, messages } from './schema';
import type { AttachmentRow, ConversationRow, MessageRow } from './schema';

function toAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    messageId: row.messageId,
    kind: row.kind,
    // Stored relative; callers want something they can render and hand to
    // llama.rn, so the absolute URL is rebuilt on the way out.
    uri: toFileUrl(row.relPath),
    mimeType: row.mimeType ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    sizeBytes: row.sizeBytes ?? undefined,
  };
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
    modelName: row.modelName ?? undefined,
    // Only assistant turns that actually generated carry these.
    stats:
      row.tokensPredicted !== null && row.tokensPredicted !== undefined
        ? {
            tokensPredicted: row.tokensPredicted,
            tokensEvaluated: row.tokensEvaluated ?? 0,
            tokensPerSecond: row.tokensPerSecond ?? 0,
            msToFirstToken: row.msToFirstToken ?? undefined,
            totalMs: row.totalMs ?? 0,
          }
        : undefined,
    attachments: files.length ? files : undefined,
  };
}

function toConversation(
  row: ConversationRow,
  messageIds: string[],
): Conversation {
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

/** Conversation metadata only — no messages. Cheap enough to run at startup. */
export async function loadConversations(): Promise<Conversation[]> {
  const rows = await db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.updatedAt));

  return rows.map(row => toConversation(row, []));
}

/** Every message in one conversation, oldest first, with its attachments. */
export async function loadMessages(conversationId: string): Promise<Message[]> {
  const [messageRows, attachmentRows] = await Promise.all([
    db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt)),
    db
      .select({ attachment: attachments })
      .from(attachments)
      .innerJoin(messages, eq(attachments.messageId, messages.id))
      .where(eq(messages.conversationId, conversationId)),
  ]);

  const filesByMessage = new Map<string, Attachment[]>();
  for (const { attachment } of attachmentRows) {
    const list = filesByMessage.get(attachment.messageId) ?? [];
    list.push(toAttachment(attachment));
    filesByMessage.set(attachment.messageId, list);
  }

  return messageRows.map(row =>
    toMessage(row, filesByMessage.get(row.id) ?? []),
  );
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
  patch: Partial<
    Pick<Conversation, 'title' | 'updatedAt' | 'modelId' | 'systemPrompt'>
  >,
): Promise<void> {
  await db
    .update(conversations)
    .set({
      ...(patch.title !== undefined ? { title: patch.title } : null),
      ...(patch.updatedAt !== undefined
        ? { updatedAt: patch.updatedAt }
        : null),
      ...(patch.modelId !== undefined
        ? { modelId: patch.modelId ?? null }
        : null),
      ...(patch.systemPrompt !== undefined
        ? { systemPrompt: patch.systemPrompt ?? null }
        : null),
    })
    .where(eq(conversations.id, conversationId));
}

export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  await db.delete(conversations).where(eq(conversations.id, conversationId));
}

/**
 * The message and its images land together or not at all — otherwise a crash in
 * between leaves files on disk that no row points at.
 */
export async function insertMessage(message: Message): Promise<void> {
  const insertRow = db.insert(messages).values({
    id: message.id,
    conversationId: message.conversationId,
    role: message.role,
    content: message.content,
    status: message.status,
    error: message.error ?? null,
    modelId: message.modelId ?? null,
    modelName: message.modelName ?? null,
    createdAt: message.createdAt,
  });

  if (!message.attachments?.length) {
    await insertRow;
    return;
  }

  await atomically(
    insertRow,
    db.insert(attachments).values(
      message.attachments.map(file => ({
        id: file.id,
        messageId: message.id,
        kind: file.kind,
        relPath: toRelative(file.uri),
        mimeType: file.mimeType ?? null,
        width: file.width ?? null,
        height: file.height ?? null,
        sizeBytes: file.sizeBytes ?? null,
      })),
    ),
  );
}

export async function updateMessage(
  messageId: string,
  patch: {
    content?: string;
    status?: MessageStatus;
    error?: string;
    stats?: GenerationStats;
  },
): Promise<void> {
  await db
    .update(messages)
    .set({
      ...(patch.content !== undefined ? { content: patch.content } : null),
      ...(patch.status !== undefined ? { status: patch.status } : null),
      ...(patch.error !== undefined ? { error: patch.error ?? null } : null),
      ...(patch.stats
        ? {
            tokensPredicted: patch.stats.tokensPredicted,
            tokensEvaluated: patch.stats.tokensEvaluated,
            tokensPerSecond: patch.stats.tokensPerSecond,
            msToFirstToken: patch.stats.msToFirstToken ?? null,
            totalMs: patch.stats.totalMs,
          }
        : null),
    })
    .where(eq(messages.id, messageId));
}

/** A reply that was mid-flight when the app died is not still generating. */
export async function resetStreamingMessages(): Promise<void> {
  await db
    .update(messages)
    .set({ status: 'stopped' })
    .where(eq(messages.status, 'streaming'));
}

/** Relative paths of every stored image, for reconciling against the disk. */
export async function loadAttachmentPaths(): Promise<string[]> {
  const rows = await db
    .select({ relPath: attachments.relPath })
    .from(attachments);
  return rows.map(row => row.relPath);
}

/**
 * Rewrites any row still holding an absolute path. The migration that
 * introduced `rel_path` renamed the old `uri` column to keep existing images,
 * but the values it inherited were absolute and would resolve to nonsense.
 */
export async function normalizeAttachmentPaths(): Promise<number> {
  const rows = await db
    .select({ id: attachments.id, relPath: attachments.relPath })
    .from(attachments);

  const stale = rows
    .map(row => ({ id: row.id, relPath: toRelative(row.relPath) }))
    .filter((row, index) => row.relPath !== rows[index].relPath);

  if (!stale.length) {
    return 0;
  }

  await atomically(
    ...stale.map(row =>
      db
        .update(attachments)
        .set({ relPath: row.relPath })
        .where(eq(attachments.id, row.id)),
    ),
  );

  return stale.length;
}
