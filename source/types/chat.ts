export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageStatus =
  | 'sending'
  | 'streaming'
  | 'sent'
  | 'stopped'
  | 'error';

export interface Attachment {
  id: string;
  messageId: string;
  kind: 'image';
  uri: string;
  mimeType?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
}

/**
 * What it cost the device to produce one reply.
 *
 * Worth keeping because on-device speed is the thing a user is actually
 * judging: whether a model earns the gigabyte it occupies is a question of
 * tokens per second on *their* phone, and that cannot be read off a spec
 * sheet. Recorded per message rather than per model because it moves with
 * context length, battery and thermal state.
 */
export interface GenerationStats {
  /** Tokens in the reply. */
  tokensPredicted: number;
  /** Prompt tokens the model had to read first. */
  tokensEvaluated: number;
  /** The headline number: generation speed, as llama.cpp measured it. */
  tokensPerSecond: number;
  /** Wait before the first word appeared — what responsiveness feels like. */
  msToFirstToken?: number;
  /** Wall clock for the whole reply. */
  totalMs: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  status: MessageStatus;
  error?: string;
  modelId?: string;
  /**
   * Copied from the model at write time. Attribution has to survive the model
   * being uninstalled, so it cannot be a lookup.
   */
  modelName?: string;
  /** Present once an assistant reply has finished generating. */
  stats?: GenerationStats;
  attachments?: Attachment[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelId?: string;
  systemPrompt?: string;
  messageIds: string[];
}
