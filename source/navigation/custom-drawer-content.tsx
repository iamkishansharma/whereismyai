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
  IconButton,
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
import { SectionList } from '@legendapp/list/section-list';

import {
  ConversationSearch,
  useChatStore,
  useConversationSections,
  useIsActiveConversation,
} from '@/features/chat';
import type { ConversationSummary } from '@/features/chat';
import Animated, { FadeInUp } from 'react-native-reanimated';

const ROW_HEIGHT = 56;

const ConversationRow = ({
  conversation,
  onPress,
  onDelete,
  onRename,
}: {
  conversation: ConversationSummary;
  onPress: () => void;
  onDelete: () => void;
  onRename: () => void;
}) => {
  const { colors } = useTheme();
  // Title and time arrive as data — the day header already needed them, so a
  // per-row store subscription for the same fields would be pure overhead.
  const isActive = useIsActiveConversation(conversation.id);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <List.Item
      title={conversation.title}
      titleNumberOfLines={1}
      description={conversation.time}
      descriptionNumberOfLines={2}
      descriptionStyle={{ color: colors.onSurfaceVariant }}
      onPress={onPress}
      style={[
        styles.row,
        isActive && { backgroundColor: colors.surfaceVariant },
      ]}
      onLongPress={() => setMenuOpen(true)}
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
              {isActive ? (
                <Icon color={props.color} size={22} source="dots-vertical" />
              ) : (
                <></>
              )}
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
  const { colors, dark } = useTheme();
  const drawerStatus = useDrawerStatus();

  const logo = dark
    ? require('@/assets/wima-logo-tr-light.png')
    : require('@/assets/wima-logo-tr-dark.png');
  const sections = useConversationSections();
  const activeId = useChatStore(state => state.activeConversationId);

  const deleteConversation = useChatStore(s => s.deleteConversation);
  const renameConversation = useChatStore(s => s.renameConversation);

  const [renamingId, setRenamingId] = useState<string>();
  const [renameText, setRenameText] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searching, setSearching] = useState(false);

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
        titleStyle={{ fontWeight: 'bold', fontSize: 16 }}
        description="Open-source, customizable & private AI assistant"
        left={props => (
          <List.Image
            {...props}
            source={logo}
            style={{ borderRadius: 16, ...props.style }}
          />
        )}
        right={props => (
          <IconButton
            {...props}
            icon="magnify"
            style={{ ...props.style, marginRight: 0, marginLeft: 0 }}
            onPress={() => {
              setShowSearchBar(!showSearchBar);
            }}
            size={22}
            mode={showSearchBar ? 'contained-tonal' : undefined}
          />
        )}
      />

      {showSearchBar && (
        <Animated.View entering={FadeInUp.duration(200)}>
          <ConversationSearch
            autoFocus={showSearchBar}
            onOpen={openConversation}
            onSearchingChange={setSearching}
          />
        </Animated.View>
      )}

      {searching ? null : sections.length === 0 ? (
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
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          estimatedItemSize={ROW_HEIGHT}
          stickySectionHeadersEnabled
          style={[
            styles.list,
            {
              marginBottom: insets.bottom + ROW_HEIGHT,
            },
          ]}
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section }) => (
            <Text
              variant="labelSmall"
              style={[
                styles.sectionHeader,
                {
                  color: colors.onSurfaceVariant,
                  backgroundColor: colors.background,
                },
              ]}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              onPress={() => openConversation(item.id)}
              onDelete={() => handleDelete(item.id)}
              onRename={() => startRename(item.id)}
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
          position: 'absolute',
          height: ROW_HEIGHT,
          bottom: insets.bottom,
          left: 0,
          right: 0,
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
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
