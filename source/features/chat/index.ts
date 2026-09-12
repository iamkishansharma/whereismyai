/**
 * The chat feature's public surface. Store-to-store imports deliberately reach
 * for `./store` directly instead of this barrel — routing them through here
 * would close a cycle with the models feature.
 */
export * from './components';
export type {
  ConversationSection,
  ConversationSummary,
} from './conversation-sections';
export { default as ChatScreen } from './screens/chat-screen';
export {
  default as useChatStore,
  useConversationMessageIds,
  useConversationModelId,
  useConversationOrder,
  useConversationSections,
  useConversationTitle,
  useHydrated,
  useIsActiveConversation,
  useIsStreaming,
  useIsTrimPoint,
  useMessage,
} from './store';
