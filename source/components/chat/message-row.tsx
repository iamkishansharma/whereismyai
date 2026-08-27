import { memo, useState } from 'react';
import { Clipboard, Image, StyleSheet, View } from 'react-native';
import { Avatar, IconButton, Text, useTheme } from 'react-native-paper';

import { useMessage } from '@/stores/chat-store';
import MarkdownMessage, { PlainMessage } from './markdown-message';
import TypingIndicator from './typing-indicator';
import useModelStore from '@/stores/model-store';
import ImageViewer from '../image-viewer';

const MessageRow = ({ messageId }: { messageId: string }) => {
  const message = useMessage(messageId);
  const { getModel } = useModelStore();
  const { colors } = useTheme();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const modelTitle = message.modelId
    ? getModel(message.modelId)?.name ?? message.modelId
    : '';

  if (!message) {
    return null;
  }

  const failed =
    (message.status === 'error' || message.status === 'stopped') &&
    !message.content;
  const streamingComplete = message.content && message.status !== 'streaming';
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';

  if (isUser) {
    return (
      <>
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
      <View
        style={{
          marginTop: 8,
          paddingHorizontal: 16,
        }}
      >
        <Avatar.Image
          size={28}
          source={{
            uri: 'https://avatars.githubusercontent.com/u/36340195?v=4',
          }}
        />
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
          {modelTitle}
        </Text>
      </View>
      <View style={styles.assistantRow}>
        {message.content ? (
          <MarkdownMessage markdown={message.content} streaming={isStreaming} />
        ) : failed ? null : (
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
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: 16,
            marginTop: 4,
          }}
        >
          <IconButton
            style={{ margin: 0 }}
            icon="clipboard-text-outline"
            size={18}
            onPress={() => {
              Clipboard.setString(message.content ?? '');
            }}
          />
          <IconButton
            style={{ margin: 0 }}
            icon="share-outline"
            size={18}
            onPress={() => {}}
          />
          <IconButton
            style={{ margin: 0 }}
            icon="thumb-up-outline"
            size={18}
            onPress={() => {}}
          />
          <IconButton
            style={{ margin: 0 }}
            icon="thumb-down-outline"
            size={18}
            onPress={() => {}}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  userRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 6,
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
});

export default memo(MessageRow);
