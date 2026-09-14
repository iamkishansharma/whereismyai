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
} from '@/features/chat/components';
import useChatStore, {
  useConversationMessageIds,
  useIsStreaming,
} from '@/features/chat/store';
import { ModelPickerSheet } from '@/features/models';
import type { ChatScreenProps } from '@/navigation/types';
import type { Attachment } from '@/types';

const ESTIMATED_ITEM_SIZE = 110;
const ANCHOR_OFFSET = 8;

// Hoisted so their identity is stable — inline versions re-render every row on
// each parent render, which defeats MessageRow's memo.
const keyExtractor = (id: string) => id;
const renderItem = ({ item }: { item: string }) => (
  <MessageRow messageId={item} />
);

const Chat = ({ navigation, route }: ChatScreenProps) => {
  const conversationId = route.params?.conversationId;
  const messageIds = useConversationMessageIds(conversationId);
  const isStreaming = useIsStreaming(conversationId);

  const sendMessage = useChatStore(state => state.sendMessage);
  const stopStreaming = useChatStore(state => state.stopStreaming);
  const setActiveConversation = useChatStore(
    state => state.setActiveConversation,
  );

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
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        estimatedItemSize={ESTIMATED_ITEM_SIZE}
        contentContainerStyle={styles.listContent}
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
        style={styles.composerHost}
      >
        <ChatComposer
          ref={composerRef}
          onLayout={onComposerLayout}
          onSend={handleSend}
          onStop={handleStop}
          isStreaming={isStreaming}
        />
      </KeyboardStickyView>

      {/* Mounted once here so the composer, the welcome card and the stack
          header can all open the same sheet. */}
      <ModelPickerSheet />
    </>
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingTop: 12,
  },
  composerHost: {
    backgroundColor: 'transparent',
  },
});

export default Chat;
