import { create } from 'zustand';
import uuid from 'react-native-uuid';
import type { RNLlamaOAICompatibleMessage } from 'llama.rn';

import {
  describeError,
  ensureLoaded,
  getVisionError,
  isVisionActive,
  runCompletion,
} from '@/llama/engine';
import * as repo from '@/db/chat-repository';
import { deleteAttachments } from '@/attachments/store';
import useModelStore, { settingsFor } from './model-store';
import type {
  Attachment,
  ChatStoreProps,
  Conversation,
  Message,
  MessageStatus,
} from '@/types';

const newId = () => String(uuid.v4());

interface StreamHandle {
  cancel: () => void;
}

const activeStreams = new Map<string, StreamHandle>();

const EMPTY_IDS: string[] = [];

const DEFAULT_TITLE = 'New Chat';
const TITLE_MAX_LENGTH = 40;
const CHECKPOINT_MS = 1500;

function titleFromText(text: string): string {
  const firstLine = text.trim().split('\n')[0] ?? '';
  if (firstLine.length <= TITLE_MAX_LENGTH) {
    return firstLine || DEFAULT_TITLE;
  }
  return `${firstLine.slice(0, TITLE_MAX_LENGTH).trimEnd()}…`;
}

function promote(order: string[], conversationId: string): string[] {
  return [conversationId, ...order.filter(id => id !== conversationId)];
}

type StoreGetter = () => ChatStoreProps;

function buildPrompt(
  conversationId: string,
  replyMessageId: string,
  systemPrompt: string,
  withVision: boolean,
  get: StoreGetter,
): RNLlamaOAICompatibleMessage[] {
  const state = get();
  const ids = state.conversations[conversationId]?.messageIds ?? [];

  const history = ids
    .filter(id => id !== replyMessageId)
    .map(id => state.messages[id])
    .filter(
      message =>
        message && (message.content.trim() || message.attachments?.length),
    )
    .map<RNLlamaOAICompatibleMessage>(message => {
      // Image parts only mean something when initMultimodal ran; without a
      // projector the media marker has nothing behind it. History can hold
      // images from a previous vision model, so they degrade to text here.
      if (withVision && message.attachments?.length) {
        return {
          role: message.role,
          content: [
            ...message.attachments.map(file => ({
              type: 'image_url',
              image_url: { url: file.uri },
            })),
            { type: 'text', text: message.content },
          ],
        };
      }
      return { role: message.role, content: message.content };
    });

  return systemPrompt.trim()
    ? [{ role: 'system', content: systemPrompt }, ...history]
    : history;
}

function conversationHasPendingImages(
  conversationId: string,
  replyMessageId: string,
  get: StoreGetter,
): boolean {
  const state = get();
  const ids = state.conversations[conversationId]?.messageIds ?? [];
  return ids.some(
    id => id !== replyMessageId && state.messages[id]?.attachments?.length,
  );
}

async function generateReply(
  conversationId: string,
  replyMessageId: string,
  get: StoreGetter,
) {
  const models = useModelStore.getState();
  const conversationModelId = get().conversations[conversationId]?.modelId;
  const modelId = conversationModelId ?? models.selectedModelId;
  const model = modelId ? models.installed[modelId] : undefined;

  if (!model) {
    get().setMessageStatus(
      replyMessageId,
      'error',
      'No model selected. Download one from the model library to start chatting.',
    );
    return;
  }

  const settings = settingsFor(model.id);
  const conversationPrompt = get().conversations[conversationId]?.systemPrompt;
  const systemPrompt = conversationPrompt ?? settings.systemPrompt;

  let checkpoint = Date.now();

  try {
    models.setEngineState('loading');
    const context = await ensureLoaded(model, settings, progress =>
      useModelStore.getState().setLoadProgress(progress),
    );
    useModelStore.getState().setEngineState('ready');

    // Whether the projector actually loaded, not whether one was downloaded.
    const withVision = isVisionActive();
    useModelStore.getState().setVisionActive(withVision);

    // Answering blind about an image the model never received is the one
    // outcome to avoid — it reads as a working feature giving wrong answers.
    if (!withVision && conversationHasPendingImages(conversationId, replyMessageId, get)) {
      const reason =
        getVisionError() ??
        `${model.name} can't read images. Choose a vision model to send pictures.`;
      get().setMessageStatus(replyMessageId, 'error', reason);
      void repo.updateMessage(replyMessageId, { status: 'error', error: reason });
      return;
    }

    const handle = runCompletion(
      context,
      buildPrompt(
        conversationId,
        replyMessageId,
        systemPrompt,
        withVision,
        get,
      ),
      settings,
      token => {
        get().appendToMessage(replyMessageId, token);
        if (Date.now() - checkpoint > CHECKPOINT_MS) {
          checkpoint = Date.now();
          const content = get().messages[replyMessageId]?.content ?? '';
          void repo.updateMessage(replyMessageId, { content });
        }
      },
      ({ stopped, error }) => {
        activeStreams.delete(conversationId);
        const content = get().messages[replyMessageId]?.content ?? '';
        const status: MessageStatus = error
          ? 'error'
          : stopped
          ? 'stopped'
          : 'sent';

        get().setMessageStatus(replyMessageId, status, error);
        void repo.updateMessage(replyMessageId, { content, status, error });
      },
    );

    activeStreams.set(conversationId, handle);
  } catch (error) {
    const message = describeError(error);
    useModelStore.getState().setEngineState('error', message);
    get().setMessageStatus(replyMessageId, 'error', message);
    void repo.updateMessage(replyMessageId, {
      status: 'error',
      error: message,
    });
  }
}

const useChatStore = create<ChatStoreProps>()((set, get) => ({
  conversations: {},
  conversationOrder: [],
  messages: {},
  activeConversationId: undefined,
  hydrated: false,

  hydrate: async () => {
    await repo.resetStreamingMessages();
    const snapshot = await repo.loadChatSnapshot();
    set({ ...snapshot, hydrated: true });
  },

  setActiveConversation: conversationId =>
    set(state =>
      state.activeConversationId === conversationId
        ? state
        : { activeConversationId: conversationId },
    ),

  createConversation: title => {
    const id = newId();
    const now = Date.now();
    const conversation: Conversation = {
      id,
      title: title ?? DEFAULT_TITLE,
      createdAt: now,
      updatedAt: now,
      modelId: useModelStore.getState().selectedModelId,
      messageIds: [],
    };

    set(state => ({
      conversations: { ...state.conversations, [id]: conversation },
      conversationOrder: [id, ...state.conversationOrder],
    }));

    void repo.insertConversation(conversation);

    return id;
  },

  deleteConversation: conversationId => {
    activeStreams.get(conversationId)?.cancel();
    activeStreams.delete(conversationId);

    set(state => {
      const conversation = state.conversations[conversationId];
      if (!conversation) {
        return state;
      }

      const conversations = { ...state.conversations };
      delete conversations[conversationId];

      const messages = { ...state.messages };
      const orphanedFiles: Attachment[] = [];
      for (const messageId of conversation.messageIds) {
        const files = messages[messageId]?.attachments;
        if (files?.length) {
          orphanedFiles.push(...files);
        }
        delete messages[messageId];
      }

      // SQLite cascades the rows; the files on disk are ours to remove.
      if (orphanedFiles.length) {
        void deleteAttachments(orphanedFiles);
      }

      return {
        conversations,
        messages,
        conversationOrder: state.conversationOrder.filter(
          id => id !== conversationId,
        ),
        activeConversationId:
          state.activeConversationId === conversationId
            ? undefined
            : state.activeConversationId,
      };
    });

    void repo.deleteConversation(conversationId);
  },

  renameConversation: (conversationId, title) => {
    set(state => {
      const conversation = state.conversations[conversationId];
      if (!conversation) {
        return state;
      }
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: { ...conversation, title },
        },
      };
    });

    void repo.updateConversation(conversationId, { title });
  },

  setConversationModel: (conversationId, modelId) => {
    set(state => {
      const conversation = state.conversations[conversationId];
      if (!conversation) {
        return state;
      }
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: { ...conversation, modelId },
        },
      };
    });

    void repo.updateConversation(conversationId, { modelId });
  },

  sendMessage: (maybeConversationId, text, files) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return maybeConversationId ?? '';
    }

    const conversationId = maybeConversationId ?? get().createConversation();

    get().stopStreaming(conversationId);

    const now = Date.now();
    const modelId =
      get().conversations[conversationId]?.modelId ??
      useModelStore.getState().selectedModelId;

    const userMessage: Message = {
      id: newId(),
      conversationId,
      role: 'user',
      content: trimmed,
      createdAt: now,
      status: 'sent',
      attachments: files?.length
        ? files.map(file => ({ ...file, messageId: '' }))
        : undefined,
    };
    if (userMessage.attachments) {
      userMessage.attachments = userMessage.attachments.map(file => ({
        ...file,
        messageId: userMessage.id,
      }));
    }

    console.log('userMessage', userMessage);
    const replyMessage: Message = {
      id: newId(),
      conversationId,
      role: 'assistant',
      content: '',
      createdAt: now + 1,
      status: 'streaming',
      modelId,
    };

    let nextTitle: string | undefined;

    console.log('replyMessage', replyMessage);

    set(state => {
      const conversation = state.conversations[conversationId];
      if (!conversation) {
        return state;
      }
      const isFirstMessage = conversation.messageIds.length === 0;
      nextTitle =
        isFirstMessage && conversation.title === DEFAULT_TITLE
          ? titleFromText(trimmed)
          : undefined;

      console.log('nextTitle', nextTitle, isFirstMessage, conversation.title);

      return {
        messages: {
          ...state.messages,
          [userMessage.id]: userMessage,
          [replyMessage.id]: replyMessage,
        },
        conversations: {
          ...state.conversations,
          [conversationId]: {
            ...conversation,
            title: nextTitle ?? conversation.title,
            updatedAt: now,
            messageIds: [
              ...conversation.messageIds,
              userMessage.id,
              replyMessage.id,
            ],
          },
        },
        conversationOrder: promote(state.conversationOrder, conversationId),
      };
    });

    void (async () => {
      await repo.insertMessage(userMessage);
      await repo.insertMessage(replyMessage);
      await repo.updateConversation(conversationId, {
        updatedAt: now,
        ...(nextTitle ? { title: nextTitle } : null),
      });
    })();

    void generateReply(conversationId, replyMessage.id, get);

    return conversationId;
  },

  stopStreaming: conversationId => {
    const handle = activeStreams.get(conversationId);
    if (!handle) {
      return;
    }
    activeStreams.delete(conversationId);
    handle.cancel();
  },

  appendToMessage: (messageId, chunk) =>
    set(state => {
      const message = state.messages[messageId];
      if (!message) {
        return state;
      }
      return {
        messages: {
          ...state.messages,
          [messageId]: { ...message, content: message.content + chunk },
        },
      };
    }),

  setMessageStatus: (messageId, status, error) =>
    set(state => {
      const message = state.messages[messageId];
      if (!message || (message.status === status && !error)) {
        return state;
      }
      return {
        messages: {
          ...state.messages,
          [messageId]: { ...message, status, error },
        },
      };
    }),
}));

export default useChatStore;

export const useHydrated = () => useChatStore(state => state.hydrated);

export const useConversationOrder = () =>
  useChatStore(state => state.conversationOrder);

export const useIsActiveConversation = (conversationId: string) =>
  useChatStore(state => state.activeConversationId === conversationId);

export const useConversationTitle = (conversationId?: string) =>
  useChatStore(state =>
    conversationId
      ? state.conversations[conversationId]?.title ?? DEFAULT_TITLE
      : DEFAULT_TITLE,
  );

export const useConversationMessageIds = (conversationId?: string) =>
  useChatStore(state =>
    conversationId
      ? state.conversations[conversationId]?.messageIds ?? EMPTY_IDS
      : EMPTY_IDS,
  );

export const useMessage = (messageId: string) =>
  useChatStore(state => state.messages[messageId]);

export const useConversationModelId = (conversationId?: string) =>
  useChatStore(state =>
    conversationId ? state.conversations[conversationId]?.modelId : undefined,
  );

export const useIsStreaming = (conversationId?: string) =>
  useChatStore(state => {
    if (!conversationId) {
      return false;
    }
    const messageIds = state.conversations[conversationId]?.messageIds;
    if (!messageIds?.length) {
      return false;
    }
    const last = state.messages[messageIds[messageIds.length - 1]];
    return last?.status === 'streaming';
  });
