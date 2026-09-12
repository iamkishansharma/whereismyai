import { useCallback, useEffect, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import {
  type DrawerContentComponentProps,
  useDrawerStatus,
} from '@react-navigation/drawer';
import {
  Button,
  Dialog,
  Divider,
  Icon,
  List,
  Menu,
  Portal,
  Text,
  TextInput,
  Tooltip,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LegendList } from '@legendapp/list/react-native';
import dayjs from 'dayjs';

import {
  useChatStore,
  useConversationOrder,
  useIsActiveConversation,
} from '@/features/chat';

const ROW_HEIGHT = 56;

const ConversationRow = ({
  conversationId,
  onPress,
  onDelete,
  onRename,
}: {
  conversationId: string;
  onPress: () => void;
  onDelete: () => void;
  onRename: () => void;
}) => {
  const { colors } = useTheme();
  const conversation = useChatStore(
    state => state.conversations[conversationId],
  );
  const isActive = useIsActiveConversation(conversationId);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!conversation) {
    return null;
  }

  return (
    <List.Item
      title={conversation.title}
      titleNumberOfLines={1}
      description={dayjs(conversation.updatedAt).format('MMM D, h:mm A')}
      descriptionStyle={{ color: colors.onSurfaceVariant }}
      onPress={onPress}
      style={[
        styles.row,
        isActive && { backgroundColor: colors.surfaceVariant },
      ]}
      titleStyle={isActive ? styles.activeTitle : styles.inactiveTitle}
      right={props => (
        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={
            <TouchableRipple
              borderless
              onPress={() => setMenuOpen(true)}
              accessibilityLabel={`Options for ${conversation.title}`}
              style={[props.style, styles.menuAnchor]}
            >
              <Icon color={props.color} size={22} source="dots-vertical" />
            </TouchableRipple>
          }
          contentStyle={styles.menuContent}
        >
          <Menu.Item
            leadingIcon="pencil-outline"
            title="Rename"
            onPress={() => {
              setMenuOpen(false);
              onRename();
            }}
          />
          <Menu.Item
            leadingIcon="trash-can-outline"
            title="Delete"
            onPress={() => {
              setMenuOpen(false);
              onDelete();
            }}
          />
        </Menu>
      )}
    />
  );
};

const ConversationDrawer = ({ navigation }: DrawerContentComponentProps) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const drawerStatus = useDrawerStatus();

  const conversationOrder = useConversationOrder();
  const activeId = useChatStore(state => state.activeConversationId);

  const deleteConversation = useChatStore(s => s.deleteConversation);
  const renameConversation = useChatStore(s => s.renameConversation);

  const [renamingId, setRenamingId] = useState<string>();
  const [renameText, setRenameText] = useState('');

  useEffect(() => {
    if (drawerStatus === 'open') {
      Keyboard.dismiss();
    }
  }, [drawerStatus]);

  const openConversation = useCallback(
    (conversationId?: string) => {
      navigation.navigate('ChatStack', {
        screen: 'Chat',
        params: { conversationId },
      });
      navigation.closeDrawer();
    },
    [navigation],
  );

  const openSettings = useCallback(() => {
    navigation.navigate('ChatStack', { screen: 'Settings' });
    navigation.closeDrawer();
  }, [navigation]);

  const startRename = useCallback((conversationId: string) => {
    setRenamingId(conversationId);
    setRenameText(
      useChatStore.getState().conversations[conversationId]?.title ?? '',
    );
  }, []);

  const commitRename = useCallback(() => {
    const trimmed = renameText.trim();
    if (renamingId && trimmed) {
      renameConversation(renamingId, trimmed);
    }
    setRenamingId(undefined);
  }, [renameConversation, renameText, renamingId]);

  const handleDelete = useCallback(
    (conversationId: string) => {
      deleteConversation(conversationId);
      if (conversationId === activeId) {
        openConversation(undefined);
      }
    },
    [activeId, deleteConversation, openConversation],
  );

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <List.Item
        title="Where Is My AI"
        titleStyle={{ fontWeight: 'bold', fontSize: 18 }}
        description={
          <View style={{ paddingTop: 3 }}>
            <Text
              style={{
                color: colors.onSurfaceVariant,
                fontSize: 12,
              }}
            >
              Your local AI assistant
            </Text>
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>
              Version 1.0.0
            </Text>
          </View>
        }
        left={props => (
          <List.Image
            {...props}
            source={require('@/assets/wima-logo.png')}
            style={{ borderRadius: 8, ...props.style }}
          />
        )}
      />

      <Divider />

      {conversationOrder.length === 0 ? (
        <View style={styles.empty}>
          <Icon
            source="message-outline"
            size={28}
            color={colors.onSurfaceVariant}
          />
          <Text
            variant="bodyMedium"
            style={[styles.emptyText, { color: colors.onSurfaceVariant }]}
          >
            No conversations yet
          </Text>
        </View>
      ) : (
        <LegendList
          data={conversationOrder}
          keyExtractor={id => id}
          estimatedItemSize={ROW_HEIGHT}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ConversationRow
              conversationId={item}
              onPress={() => openConversation(item)}
              onDelete={() => handleDelete(item)}
              onRename={() => startRename(item)}
            />
          )}
        />
      )}

      <Divider />

      <View
        style={{
          gap: 8,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginVertical: 16,
          position: 'relative',
        }}
      >
        <List.Item
          style={{ flex: 1 }}
          title="Settings"
          onPress={openSettings}
          left={props => <List.Icon {...props} icon="cog-outline" />}
        />
        <View style={{ position: 'absolute', right: 16 }}>
          <Tooltip title="Create a new chat">
            <Button
              mode="contained"
              icon="plus"
              accessibilityLabel="New Chat"
              onPress={() => {
                openConversation(undefined);
              }}
            >
              New
            </Button>
          </Tooltip>
        </View>
      </View>

      <Portal>
        <Dialog
          visible={renamingId !== undefined}
          onDismiss={() => setRenamingId(undefined)}
          style={styles.dialog}
        >
          <Dialog.Title>Rename conversation</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Name"
              value={renameText}
              onChangeText={setRenameText}
              onSubmitEditing={commitRename}
              autoFocus
              returnKeyType="done"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenamingId(undefined)}>Cancel</Button>
            <Button onPress={commitRename} disabled={!renameText.trim()}>
              Rename
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  newChat: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 4,
  },
  row: {
    paddingLeft: 0,
    paddingRight: 16,
  },
  activeTitle: {
    fontWeight: '600',
  },
  inactiveTitle: {
    fontWeight: 'normal',
  },
  menuAnchor: {
    borderRadius: 9999,
    padding: 6,
  },
  menuContent: {
    borderRadius: 20,
  },
  dialog: {
    borderRadius: 20,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    textAlign: 'center',
  },
  avatar: {
    borderRadius: 40,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

export default ConversationDrawer;
