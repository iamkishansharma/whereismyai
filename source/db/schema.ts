import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    modelId: text('model_id'),
    systemPrompt: text('system_prompt'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  table => [index('conversations_updated_at_idx').on(table.updatedAt)],
);

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
    content: text('content').notNull().default(''),
    status: text('status', {
      enum: ['sending', 'streaming', 'sent', 'stopped', 'error'],
    })
      .notNull()
      .default('sent'),
    error: text('error'),
    modelId: text('model_id'),
    createdAt: integer('created_at').notNull(),
  },
  table => [
    index('messages_conversation_idx').on(table.conversationId, table.createdAt),
  ],
);

export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id').primaryKey(),
    messageId: text('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['image'] }).notNull().default('image'),
    uri: text('uri').notNull(),
    mimeType: text('mime_type'),
    width: integer('width'),
    height: integer('height'),
    sizeBytes: integer('size_bytes'),
    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  table => [index('attachments_message_idx').on(table.messageId)],
);

export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type AttachmentRow = typeof attachments.$inferSelect;
