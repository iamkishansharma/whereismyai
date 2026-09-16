import { memo, useMemo, useState } from 'react';
import { Clipboard, Image, Share, StyleSheet, View } from 'react-native';
import { Avatar, IconButton, Text, useTheme } from 'react-native-paper';

import ImageViewer from '@/shared/ui/image-viewer';
import { splitReasoning } from '@/core/llama/reasoning';
import { useIsTrimPoint, useMessage } from '../store';
import { useMessageModelName } from './use-message-model-name';
import MessageStats from './message-stats';
import { useShowGenerationStats } from '@/features/settings/store';
import MarkdownMessage, { PlainMessage } from './markdown-message';
import ThinkingBlock from './thinking-block';
import TypingIndicator from './typing-indicator';

/**
 * Marks where the model's context begins. Without it a long conversation looks
 * like it forgot the early messages for no reason.
 */
const TrimNotice = () => {
  const { colors } = useTheme();
  return (
    <View style={styles.trimRow}>
      <View
        style={[styles.trimLine, { backgroundColor: colors.outlineVariant }]}
      />
      <Text
        variant="labelSmall"
        style={[styles.trimText, { color: colors.onSurfaceVariant }]}
      >
        Earlier messages trimmed to fit the context window
      </Text>
    </View>
  );
};

const MessageRow = ({ messageId }: { messageId: string }) => {
  const message = useMessage(messageId);
  const isTrimPoint = useIsTrimPoint(messageId);
  const modelTitle = useMessageModelName(message?.modelId, message?.modelName);
  const { colors, dark } = useTheme();
  const [showStats] = useShowGenerationStats();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const logo = dark
    ? require('@/assets/wima-logo-tr-light.png')
    : require('@/assets/wima-logo-tr-dark.png');

  // What is stored is exactly what the model produced, markers and all. The
  // answer is separated here rather than on the way in, so replies already in
  // the database render correctly too.
  const { reasoning, content: answer } = useMemo(
    () => splitReasoning(message?.content ?? ''),
    [message?.content],
  );

  // Deleting a conversation unmounts its rows a frame after the message is
  // gone from the store, so this has to come before any field is read.
  if (!message) {
    return null;
  }

  // Reasoning on its own still counts as something to show: a reply stopped
  // mid-thought has no answer, but it is not an empty failure either.
  const hasOutput = Boolean(answer || reasoning);
  const failed =
    (message.status === 'error' || message.status === 'stopped') && !hasOutput;
  const streamingComplete = hasOutput && message.status !== 'streaming';
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';

  if (isUser) {
    return (
      <>
        {isTrimPoint && <TrimNotice />}
        <View style={styles.userRow}>
          <View
            style={[
              styles.userBubble,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            {message.attachments?.length ? (
              <View style={styles.thumbRow}>
                {message.attachments.map(file => (
                  <View key={file.id}>
                    {selectedImage && (
                      <ImageViewer
                        uri={selectedImage}
                        onClose={() => {
                          setSelectedImage(null);
                        }}
                      />
                    )}
                    <Image
                      source={{ uri: file.uri }}
                      style={[
                        styles.thumb,
                        { borderColor: colors.outlineVariant },
                      ]}
                      onTouchStart={() => setSelectedImage(file.uri)}
                    />
                  </View>
                ))}
              </View>
            ) : null}
            {message.content ? <PlainMessage text={message.content} /> : null}
          </View>
        </View>
      </>
    );
  }

  return (
    <View>
      {isTrimPoint && <TrimNotice />}
      <View
        style={{
          marginTop: 8,
          paddingHorizontal: 16,
        }}
      >
        <Avatar.Image size={28} source={logo} />
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
          {modelTitle}
        </Text>
      </View>
      <View style={styles.assistantRow}>
        <ThinkingBlock
          reasoning={reasoning}
          streaming={isStreaming}
          answerStarted={Boolean(answer)}
        />

        {answer ? (
          <MarkdownMessage markdown={answer} streaming={isStreaming} />
        ) : failed || reasoning ? null : (
          <TypingIndicator />
        )}

        {message.status === 'error' && (
          <View
            style={[styles.error, { backgroundColor: colors.errorContainer }]}
          >
            <Text
              variant="bodySmall"
              style={{ color: colors.onErrorContainer }}
              selectable
            >
              {message.error ?? 'Something went wrong.'}
            </Text>
          </View>
        )}

        {message.status === 'stopped' && (
          <Text
            variant="labelSmall"
            style={[styles.stopped, { color: colors.onSurfaceVariant }]}
          >
            Stopped
          </Text>
        )}
      </View>
      {!failed && streamingComplete && (
        <View style={styles.messageActionsRow}>
          {/* The answer, never the model's narration — copying someone a
              monologue they never asked to read is the same bug twice. */}
          {answer && (
            <IconButton
              style={{ margin: 0 }}
              icon="clipboard-text-outline"
              size={18}
              onPress={() => {
                Clipboard.setString(answer);
              }}
            />
          )}
          {answer && (
            <IconButton
              style={{ margin: 0 }}
              icon="share-outline"
              size={18}
              onPress={() => {
                Share.share({
                  message: answer,
                  title: 'Message from WhereIsMyAI',
                });
              }}
            />
          )}
          {/* TODO :: Handle thumbs up action */}
          <IconButton
            style={{ margin: 0, display: 'none' }}
            icon="thumb-up-outline"
            size={18}
            onPress={() => {}}
          />
          {/* TODO :: Handle thumbs down action */}
          <IconButton
            style={{ margin: 0, display: 'none' }}
            icon="thumb-down-outline"
            size={18}
            onPress={() => {}}
          />

          {showStats && message.stats && <MessageStats stats={message.stats} />}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  trimRow: {
    paddingHorizontal: 24,
    marginTop: 20,
    gap: 8,
  },
  trimLine: {
    height: StyleSheet.hairlineWidth,
  },
  trimText: {
    textAlign: 'center',
  },
  userRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 20,
  },
  thumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  thumb: {
    width: 132,
    height: 132,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  userBubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomRightRadius: 6,
  },
  assistantRow: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  error: {
    marginTop: 4,
    padding: 12,
    borderRadius: 12,
  },
  stopped: {
    marginTop: 2,
    fontStyle: 'italic',
  },
  messageActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
  },
});

export default memo(MessageRow);
