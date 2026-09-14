import { useMemo } from 'react';
import dayjs from 'dayjs';
import { create } from 'zustand';
import uuid from 'react-native-uuid';

import {
  describeError,
  ensureLoaded,
  getVisionError,
  isVisionActive,
  runCompletion,
} from '@/core/llama';
import { answeringImages, buildPrompt, historyFor } from './prompt';
import { groupByDay, type ConversationSection } from './conversation-sections';
import * as repo from '@/core/db/chat-repository';
import { deleteAttachments } from '@/core/attachments';
import useModelStore, { settingsFor } from '@/features/models/store';
import type {
  Attachment,
  Conversation,
  GenerationStats,
  Message,
  MessageStatus,
} from '@/types';

interface ChatStore {
  conversations: Record<string, Conversation>;
  conversationOrder: string[];
  messages: Record<string, Message>;
  /**
   * Oldest message still inside the model's context, per conversation. Derived
   * from the current model and its settings, so deliberately not persisted.
   */
  trimmedFrom: Record<string, string>;
  /** Conversations whose messages have been read in. */
  loaded: Record<string, boolean>;

  activeConversationId?: string;
  hydrated: boolean;
  setActiveConversation: (conversationId?: string) => void;
  loadConversation: (conversationId: string) => Promise<void>;
  setTrimmedFrom: (conversationId: string, messageId?: string) => void;
  hydrate: () => Promise<void>;

  createConversation: (title?: string) => string;
  deleteConversation: (conversationId: string) => void;
  renameConversation: (conversationId: string, title: string) => void;

  setConversationModel: (conversationId: string, modelId?: string) => void;
  chooseModel: (modelId: string) => void;

  sendMessage: (
    conversationId: string | undefined,
    text: string,
    files?: Attachment[],
  ) => string;
  stopStreaming: (conversationId: string) => void;

  appendToMessage: (messageId: string, chunk: string) => void;
  setMessageStatus: (
    messageId: string,
    status: MessageStatus,
    error?: string,
    stats?: GenerationStats,
  ) => void;
}

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

type StoreGetter = () => ChatStore;

async function generateReply(
  conversationId: string,
  replyMessageId: string,
  get: StoreGetter,
) {
  const models = useModelStore.getState();
  // A conversation keeps its own model, but don't strand it on one that has
  // since been uninstalled — fall back to the current selection.
  const pinnedId = get().conversations[conversationId]?.modelId;
  const modelId =
    pinnedId && models.installed[pinnedId] ? pinnedId : models.selectedModelId;
  const model = modelId ? models.installed[modelId] : undefined;

  if (!model) {
    get().setMessageStatus(
      replyMessageId,
      'error',
      'No model selected. Download one from the model library to start chatting.',
    );
    return;
  }

  // Reads the GGUF header once so the context window comes from what the model
  // declares. Without it every model would be held to the flat 2048 default.
  await models.ensureModelInfo(model.id);

  const settings = settingsFor(model.id);
  const conversationPrompt = get().conversations[conversationId]?.systemPrompt;
  const systemPrompt = conversationPrompt ?? settings.systemPrompt;

  let checkpoint = Date.now();

  try {
    models.setEngineState('loading');
    const context = await ensureLoaded(
      useModelStore.getState().installed[model.id] ?? model,
      settings,
      progress => useModelStore.getState().setLoadProgress(progress),
    );
    useModelStore.getState().setEngineState('ready');

    // Whether the projector actually loaded, not whether one was downloaded.
    const withVision = isVisionActive();
    useModelStore.getState().setVisionActive(withVision);

    // Answering blind about an image the model never received is the one
    // outcome to avoid — it reads as a working feature giving wrong answers.
    const history = historyFor(
      get().conversations[conversationId],
      get().messages,
      replyMessageId,
    );

    if (!withVision && answeringImages(history)) {
      const reason =
        getVisionError() ??
        `${model.name} can't read images. Choose a vision model to send pictures.`;
      get().setMessageStatus(replyMessageId, 'error', reason);
      void repo.updateMessage(replyMessageId, {
        status: 'error',
        error: reason,
      });
      return;
    }

    const prompt = await buildPrompt(context, {
      history,
      systemPrompt,
      withVision,
      settings,
    });

    if (prompt.overflow) {
      const reason =
        `This message is too long for ${model.name}'s ${settings.nCtx} token ` +
        'context window. Shorten it, or raise the context window in ' +
        'Generation settings.';
      get().setMessageStatus(replyMessageId, 'error', reason);
      void repo.updateMessage(replyMessageId, {
        status: 'error',
        error: reason,
      });
      return;
    }

    // Drives the divider in the transcript, so a conversation that outgrew the
    // window says so instead of appearing to forget at random.
    get().setTrimmedFrom(conversationId, prompt.trimmedFromId);

    const handle = runCompletion(
      context,
      prompt.messages,
      settings,
      token => {
        get().appendToMessage(replyMessageId, token);
        if (Date.now() - checkpoint > CHECKPOINT_MS) {
          checkpoint = Date.now();
          const content = get().messages[replyMessageId]?.content ?? '';
          void repo.updateMessage(replyMessageId, { content });
        }
      },
      ({ stopped, error, contextFull, stats }) => {
        activeStreams.delete(conversationId);
        const content = get().messages[replyMessageId]?.content ?? '';

        // A full context makes llama.rn return without generating. Left
        // unreported it reads as the model ignoring the question entirely.
        const overflowed = contextFull && !content;
        const reason = overflowed
          ? `This conversation no longer fits in ${model.name}'s ${settings.nCtx} ` +
            'token context window. Start a new chat, or raise the context ' +
            'window in Generation settings.'
          : error;

        const status: MessageStatus = reason
          ? 'error'
          : stopped || contextFull
          ? 'stopped'
          : 'sent';

        get().setMessageStatus(replyMessageId, status, reason, stats);
        void repo.updateMessage(replyMessageId, {
          content,
          status,
          error: reason,
          stats,
        });
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

const useChatStore = create<ChatStore>()((set, get) => ({
  conversations: {},
  conversationOrder: [],
  messages: {},
  trimmedFrom: {},
  loaded: {},
  activeConversationId: undefined,
  hydrated: false,

  /**
   * Conversation metadata only. Reading every message of every conversation
   * here is what used to make a long history slow to start; the transcript is
   * fetched when a conversation is actually opened.
   */
  hydrate: async () => {
    await repo.resetStreamingMessages();
    const list = await repo.loadConversations();

    set({
      conversations: Object.fromEntries(
        list.map(conversation => [conversation.id, conversation]),
      ),
      conversationOrder: list.map(conversation => conversation.id),
      hydrated: true,
    });
  },

  loadConversation: async conversationId => {
    // A conversation created in this session already has its messages in
    // memory, and re-reading mid-stream would clobber the live reply.
    if (get().loaded[conversationId]) {
      return;
    }

    const list = await repo.loadMessages(conversationId);

    set(state => {
      const conversation = state.conversations[conversationId];
      if (!conversation) {
        return state;
      }
      return {
        loaded: { ...state.loaded, [conversationId]: true },
        messages: {
          ...state.messages,
          ...Object.fromEntries(list.map(message => [message.id, message])),
        },
        conversations: {
          ...state.conversations,
          [conversationId]: {
            ...conversation,
            messageIds: list.map(message => message.id),
          },
        },
      };
    });
  },

  setActiveConversation: conversationId => {
    set(state =>
      state.activeConversationId === conversationId
        ? state
        : { activeConversationId: conversationId },
    );
    if (conversationId) {
      void get().loadConversation(conversationId);
    }
  },

  setTrimmedFrom: (conversationId, messageId) =>
    set(state => {
      if (state.trimmedFrom[conversationId] === messageId) {
        return state;
      }
      const trimmedFrom = { ...state.trimmedFrom };
      if (messageId) {
        trimmedFrom[conversationId] = messageId;
      } else {
        delete trimmedFrom[conversationId];
      }
      return { trimmedFrom };
    }),

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
      loaded: { ...state.loaded, [id]: true },
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

      const trimmedFrom = { ...state.trimmedFrom };
      delete trimmedFrom[conversationId];
      const loaded = { ...state.loaded };
      delete loaded[conversationId];

      return {
        conversations,
        messages,
        trimmedFrom,
        loaded,
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

  // The single way to pick a model. Writing only the global selection leaves
  // the open conversation pinned to whatever it was created with, so the chip
  // updates while replies keep coming from the old model.
  chooseModel: modelId => {
    useModelStore.getState().selectModel(modelId);

    const activeId = get().activeConversationId;
    if (activeId) {
      get().setConversationModel(activeId, modelId);
    }
  },

  sendMessage: (maybeConversationId, text, files) => {
    const trimmed = text.trim();
    // The composer allows an image with no caption, so bailing on empty text
    // alone made that send silently do nothing.
    if (!trimmed && !files?.length) {
      return maybeConversationId ?? '';
    }

    const conversationId = maybeConversationId ?? get().createConversation();

    get().stopStreaming(conversationId);

    const now = Date.now();
    const models = useModelStore.getState();
    const modelId =
      get().conversations[conversationId]?.modelId ?? models.selectedModelId;
    // Copied now so the transcript can still name the model after it is
    // uninstalled — a lookup would come back empty.
    const modelName = modelId ? models.installed[modelId]?.name : undefined;

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

    const replyMessage: Message = {
      id: newId(),
      conversationId,
      role: 'assistant',
      content: '',
      createdAt: now + 1,
      status: 'streaming',
      modelId,
      modelName,
    };

    let nextTitle: string | undefined;

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

  setMessageStatus: (messageId, status, error, stats) =>
    set(state => {
      const message = state.messages[messageId];
      // Stats arrive with the terminal status, so a no-op on status alone
      // would drop them.
      if (!message || (message.status === status && !error && !stats)) {
        return state;
      }
      return {
        messages: {
          ...state.messages,
          [messageId]: {
            ...message,
            status,
            error,
            stats: stats ?? message.stats,
          },
        },
      };
    }),
}));

export default useChatStore;

export const useHydrated = () => useChatStore(state => state.hydrated);

export const useConversationOrder = () =>
  useChatStore(state => state.conversationOrder);

/**
 * History grouped into day sections, newest first.
 *
 * The grouping is memoised on the start of the current day rather than on
 * `Date.now()`, so it survives re-renders but still re-labels "Today" once the
 * date rolls over.
 */
export const useConversationSections = (): ConversationSection[] => {
  const conversations = useChatStore(state => state.conversations);
  const order = useChatStore(state => state.conversationOrder);
  const dayStart = dayjs().startOf('day').valueOf();

  return useMemo(
    () =>
      groupByDay(
        order
          .map(id => conversations[id])
          .filter((conversation): conversation is Conversation =>
            Boolean(conversation),
          ),
        dayStart,
      ),
    [conversations, order, dayStart],
  );
};

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

/**
 * Whether this message is the oldest one still inside the model's context, and
 * therefore the point where the transcript shows the trim divider. The first
 * message of a conversation is never a trim point — nothing came before it.
 */
export const useIsTrimPoint = (messageId: string) =>
  useChatStore(state => {
    const conversationId = state.messages[messageId]?.conversationId;
    if (!conversationId || state.trimmedFrom[conversationId] !== messageId) {
      return false;
    }
    return state.conversations[conversationId]?.messageIds[0] !== messageId;
  });

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
