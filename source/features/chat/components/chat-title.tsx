import { Platform, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { useConversationTitle } from '@/features/chat/store';

const ChatTitle = ({ conversationId }: { conversationId?: string }) => {
  const title = useConversationTitle(conversationId);

  return (
    <Text numberOfLines={1} style={styles.title}>
      {title}
    </Text>
  );
};

const styles = StyleSheet.create({
  title: {
    maxWidth: 220,
    fontWeight: Platform.select({ ios: 'bold', default: 'medium' }),
    textAlign: 'center',
    fontSize: Platform.select({
      ios: 17,
      android: 20,
      default: 18,
    }),
  },
});

export default ChatTitle;
