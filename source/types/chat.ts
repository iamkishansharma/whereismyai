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

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  status: MessageStatus;
  error?: string;
  modelId?: string;
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
