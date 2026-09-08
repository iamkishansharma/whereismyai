import { DrawerActions, useNavigation } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { IconButton } from 'react-native-paper';
import { StyleSheet, View } from 'react-native';

import { ChatScreen, ChatTitle } from '@/features/chat';
import {
  GenerationSettings as GenerationSettingsScreen,
  ModelDetail,
  ModelLibrary,
  openModelPicker,
} from '@/features/models';
import { SettingsScreen } from '@/features/settings';
import VoiceScreen from '@/features/voice/screens/voice-screen';
import { plainHeaderOptions, transparentHeaderOptions } from './header-options';
import type { ChatStackParamList } from './types';

const Stack = createNativeStackNavigator<ChatStackParamList>();

export type ChatStackNavigation = NativeStackNavigationProp<ChatStackParamList>;

const DrawerToggle = () => {
  const navigation = useNavigation();

  return (
    <IconButton
      icon="menu"
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      accessibilityLabel="Open conversations"
      style={styles.headerButton}
    />
  );
};
const ChatHeaderRight = () => {
  const navigation = useNavigation<ChatStackNavigation>();

  return (
    <View style={styles.headerRight}>
      <IconButton
        icon="tune-variant"
        onPress={openModelPicker}
        accessibilityLabel="Choose model"
        style={styles.headerButton}
      />
      <IconButton
        icon="plus"
        onPress={() =>
          navigation.navigate('Chat', { conversationId: undefined })
        }
        accessibilityLabel="New chat"
        style={styles.headerButton}
      />
    </View>
  );
};

const ChatNavigator = () => (
  <Stack.Navigator screenOptions={plainHeaderOptions}>
    <Stack.Screen
      name="Chat"
      component={ChatScreen}
      options={({ route }) => ({
        headerTitle: () => (
          <ChatTitle conversationId={route.params?.conversationId} />
        ),
        headerLeft: () => <DrawerToggle />,
        headerRight: () => <ChatHeaderRight />,
        ...transparentHeaderOptions,
      })}
    />

    <Stack.Screen
      name="Settings"
      component={SettingsScreen}
      options={{ title: 'Settings', ...transparentHeaderOptions }}
    />

    <Stack.Screen
      name="ModelLibrary"
      component={ModelLibrary}
      options={{ title: 'Models', ...transparentHeaderOptions }}
    />

    <Stack.Screen
      name="ModelDetail"
      component={ModelDetail}
      options={{ title: 'Model', ...transparentHeaderOptions }}
    />

    <Stack.Screen
      name="GenerationSettings"
      component={GenerationSettingsScreen}
      options={{ title: 'Generation', ...transparentHeaderOptions }}
    />

    {/* Full screen and chrome-free: the orb is the interface, and a header
        back button would compete with the end-call control. */}
    <Stack.Screen
      name="Voice"
      component={VoiceScreen}
      options={{
        headerShown: false,
        presentation: 'fullScreenModal',
        animation: 'fade',
        gestureEnabled: false,
      }}
    />
  </Stack.Navigator>
);

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    margin: 0,
  },
});

export default ChatNavigator;
