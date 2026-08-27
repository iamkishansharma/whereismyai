import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { useConversationTitle } from '@/stores/chat-store';

const ChatTitle = ({ conversationId }: { conversationId?: string }) => {
  const title = useConversationTitle(conversationId);

  return (
    <Text variant="titleMedium" numberOfLines={1} style={styles.title}>
      {title}
    </Text>
  );
};

const styles = StyleSheet.create({
  title: {
    maxWidth: 220,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ChatTitle;
