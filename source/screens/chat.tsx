import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import {
  KeyboardAwareLegendList,
  useKeyboardChatComposerInset,
  useKeyboardScrollToEnd,
} from '@legendapp/list/keyboard';
import type { LegendListRef } from '@legendapp/list/react-native';

import {
  ChatComposer,
  ChatWelcome,
  COMPOSER_MIN_HEIGHT,
  MessageRow,
  type ChatComposerHandle,
} from '@/components/chat';
import useChatStore, {
  useConversationMessageIds,
  useIsStreaming,
} from '@/stores/chat-store';
import { useSelectedModel } from '@/stores/model-store';
import type { ChatScreenProps } from '@/navigation/types';
import type { Attachment } from '@/types';

const ESTIMATED_ITEM_SIZE = 110;
const ANCHOR_OFFSET = 8;

const Chat = ({ navigation, route }: ChatScreenProps) => {
  const conversationId = route.params?.conversationId;
  const messageIds = useConversationMessageIds(conversationId);
  const isStreaming = useIsStreaming(conversationId);

  const sendMessage = useChatStore(state => state.sendMessage);
  const stopStreaming = useChatStore(state => state.stopStreaming);
  const setActiveConversation = useChatStore(
    state => state.setActiveConversation,
  );
  const selectedModel = useSelectedModel();

  const insets = useSafeAreaInsets();

  const listRef = useRef<LegendListRef>(null);
  const composerRef = useRef<ChatComposerHandle>(null);

  const [anchorIndex, setAnchorIndex] = useState<number>();

  const { contentInsetEndAdjustment, onComposerLayout } =
    useKeyboardChatComposerInset(
      listRef,
      composerRef as unknown as Parameters<
        typeof useKeyboardChatComposerInset
      >[1],
      COMPOSER_MIN_HEIGHT,
    );

  const { freeze, scrollMessageToEnd } = useKeyboardScrollToEnd({ listRef });

  const anchoredEndSpace = useMemo(
    () =>
      anchorIndex === undefined
        ? undefined
        : { anchorIndex, anchorOffset: ANCHOR_OFFSET },
    [anchorIndex],
  );

  useEffect(() => {
    if (!isStreaming) {
      setAnchorIndex(undefined);
    }
  }, [isStreaming]);

  useFocusEffect(
    useCallback(() => {
      setActiveConversation(conversationId);
    }, [conversationId, setActiveConversation]),
  );

  const handleSend = useCallback(
    (text: string, files?: Attachment[]) => {
      setAnchorIndex(messageIds.length);

      const targetId = sendMessage(conversationId, text, files);
      if (targetId !== conversationId) {
        navigation.setParams({ conversationId: targetId });
      }

      scrollMessageToEnd({ animated: true, closeKeyboard: false });
    },
    [
      conversationId,
      messageIds.length,
      navigation,
      scrollMessageToEnd,
      sendMessage,
    ],
  );

  const handleStop = useCallback(() => {
    if (conversationId) {
      stopStreaming(conversationId);
    }
  }, [conversationId, stopStreaming]);

  return (
    <>
      <KeyboardAwareLegendList
        ref={listRef}
        data={messageIds}
        keyExtractor={id => id}
        renderItem={({ item }) => <MessageRow messageId={item} />}
        estimatedItemSize={ESTIMATED_ITEM_SIZE}
        contentContainerStyle={styles.listContent}
        // maintainScrollAtEnd={isStreaming}
        initialScrollAtEnd
        maintainVisibleContentPosition={{ data: true, size: true }}
        keyboardLiftBehavior="whenAtEnd"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentInsetEndAdjustment={contentInsetEndAdjustment}
        anchoredEndSpace={anchoredEndSpace}
        freeze={freeze}
        keyboardOffset={insets.bottom}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={ChatWelcome}
      />
      <KeyboardStickyView
        offset={{ closed: 0, opened: insets.bottom }}
        style={{ backgroundColor: 'transparent' }}
      >
        <ChatComposer
          ref={composerRef}
          onLayout={onComposerLayout}
          onSend={handleSend}
          onStop={handleStop}
          isStreaming={isStreaming}
          disabledReason={selectedModel ? undefined : 'Choose a model'}
          onDisabledPress={() => navigation.navigate('ModelLibrary')}
        />
      </KeyboardStickyView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: 12,
  },
});

export default Chat;
