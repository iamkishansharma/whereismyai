import { DrawerActions, useNavigation } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { IconButton } from 'react-native-paper';
import { StyleSheet, View } from 'react-native';

import { ChatTitle } from '@/components/chat';
import {
  plainHeaderOptions,
  transparentHeaderOptions,
} from '@/components/header-options';
import Chat from '@/screens/chat';
import GenerationSettingsScreen from '@/screens/generation-settings';
import ModelDetail from '@/screens/model-detail';
import ModelLibrary from '@/screens/model-library';
import ModelPicker from '@/screens/model-picker';
import Settings from '@/screens/settings';
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
const BackNav = () => {
  const navigation = useNavigation();

  return (
    <IconButton
      icon="close"
      onPress={() => navigation.goBack()}
      accessibilityLabel="Close"
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
        onPress={() => navigation.navigate('ModelPicker')}
        accessibilityLabel="Choose model"
        style={styles.headerButton}
      />
      <IconButton
        icon="plus"
        onPress={() => navigation.navigate('Chat', { conversationId: undefined })}
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
      component={Chat}
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
      component={Settings}
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

    <Stack.Group screenOptions={{ presentation: 'modal' }}>
      <Stack.Screen
        name="ModelPicker"
        component={ModelPicker}
        options={{
          title: 'Models',
          headerRight: () => <BackNav />,
          ...transparentHeaderOptions,
        }}
      />
    </Stack.Group>
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
