import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

/**
 * Everything the app owns lives here. Paths are stored relative to the
 * documents directory — see `core/paths.ts` for why absolute ones are unsafe.
 */

export const models = sqliteTable(
  'models',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    repo: text('repo').notNull(),
    filename: text('filename').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    relPath: text('rel_path').notNull(),

    mmprojFilename: text('mmproj_filename'),
    mmprojSizeBytes: integer('mmproj_size_bytes'),
    mmprojRelPath: text('mmproj_rel_path'),

    // Read from the GGUF header on first load, not from the catalog entry.
    architecture: text('architecture'),
    paramCount: integer('param_count'),
    contextLength: integer('context_length'),
    quant: text('quant'),

    downloadedAt: integer('downloaded_at').notNull(),
  },
  table => [index('models_downloaded_at_idx').on(table.downloadedAt)],
);

/**
 * One row per model the user has actually tuned. Every column is nullable and
 * NULL means "not overridden", which is what lets an improved default — such as
 * the context window derived from the GGUF header — still reach the model.
 */
export const modelSettings = sqliteTable('model_settings', {
  modelId: text('model_id')
    .primaryKey()
    .references(() => models.id, { onDelete: 'cascade' }),
  systemPrompt: text('system_prompt'),
  temperature: real('temperature'),
  topP: real('top_p'),
  topK: integer('top_k'),
  repeatPenalty: real('repeat_penalty'),
  nPredict: integer('n_predict'),
  nCtx: integer('n_ctx'),
  nGpuLayers: integer('n_gpu_layers'),
});

/**
 * Exactly one row. Typed columns rather than key/value so `selectedModelId` can
 * carry a foreign key: deleting the model in use clears the selection by
 * itself, with no application code to forget.
 */
export const appState = sqliteTable(
  'app_state',
  {
    id: integer('id').primaryKey(),
    selectedModelId: text('selected_model_id').references(() => models.id, {
      onDelete: 'set null',
    }),
    themeMode: text('theme_mode', { enum: ['system', 'light', 'dark'] })
      .notNull()
      .default('system'),
    // Unused since the palette toggle was removed — the app has one look now.
    // Kept so the schema still matches databases created by the 0000 baseline;
    // drop it in the same change that next resets the database.
    themeColor: text('theme_color', { enum: ['default', 'monochrome'] })
      .notNull()
      .default('monochrome'),
    // Off by default: useful when comparing models, noise otherwise.
    showGenerationStats: integer('show_generation_stats', { mode: 'boolean' })
      .notNull()
      .default(false),
    onboardingDone: integer('onboarding_done', { mode: 'boolean' })
      .notNull()
      .default(false),
  },
  table => [check('app_state_single_row', sql`${table.id} = 1`)],
);

export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    // Un-pins itself when the model is deleted, which is the fallback the chat
    // store used to hand-roll.
    modelId: text('model_id').references(() => models.id, {
      onDelete: 'set null',
    }),
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
    // Attribution is history, so deliberately no foreign key: deleting a model
    // must not rewrite or erase which model wrote a past reply. The name is
    // copied at write time so the transcript stays readable afterwards.
    modelId: text('model_id'),
    modelName: text('model_name'),
    // What the reply cost this device. Null for user turns, and for replies
    // that were cancelled or never generated a token.
    tokensPredicted: integer('tokens_predicted'),
    tokensEvaluated: integer('tokens_evaluated'),
    tokensPerSecond: real('tokens_per_second'),
    msToFirstToken: integer('ms_to_first_token'),
    totalMs: integer('total_ms'),
    createdAt: integer('created_at').notNull(),
  },
  table => [
    index('messages_conversation_idx').on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id').primaryKey(),
    messageId: text('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['image'] })
      .notNull()
      .default('image'),
    relPath: text('rel_path').notNull(),
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

export type ModelRow = typeof models.$inferSelect;
export type ModelSettingsRow = typeof modelSettings.$inferSelect;
export type AppStateRow = typeof appState.$inferSelect;
export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type AttachmentRow = typeof attachments.$inferSelect;
