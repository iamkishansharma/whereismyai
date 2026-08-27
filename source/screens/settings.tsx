import { Alert, ScrollView, StyleSheet } from 'react-native';
import {
  Divider,
  List,
  SegmentedButtons,
  Switch,
  Text,
  useTheme,
} from 'react-native-paper';

import useDefaultStore, { useThemeMode } from '@/stores/default-store';
import useChatStore from '@/stores/chat-store';
import type { ThemeMode } from '@/types';

const THEME_MODES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const Settings = () => {
  const { colors } = useTheme();
  const [themeMode, setThemeMode] = useThemeMode();
  const themeColor = useDefaultStore(state => state.themeColor);
  const setThemeColor = useDefaultStore(state => state.setThemeColor);
  const setShowOnboarding = useDefaultStore(state => state.setShowOnboarding);

  const conversationOrder = useChatStore(state => state.conversationOrder);
  const deleteConversation = useChatStore(state => state.deleteConversation);

  const clearAll = () =>
    Alert.alert('Delete all conversations?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => [...conversationOrder].forEach(deleteConversation),
      },
    ]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <List.Section>
        <List.Subheader>Appearance</List.Subheader>
        <SegmentedButtons
          style={{ marginHorizontal: 16 }}
          value={themeMode}
          onValueChange={value => setThemeMode(value as ThemeMode)}
          buttons={THEME_MODES.map(mode => ({
            value: mode.value,
            label: mode.label,
            icon:
              mode.value === 'system'
                ? 'cellphone'
                : mode.value === 'light'
                ? 'white-balance-sunny'
                : 'weather-night',
          }))}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>Colour</List.Subheader>

        <List.Item
          title="Monochrome"
          description={
            themeColor === 'monochrome'
              ? 'Apply shades of grey to the app'
              : 'Use the default Material color palette'
          }
          left={props => <List.Icon {...props} icon="palette" />}
          right={props => (
            <Switch
              value={themeColor === 'monochrome'}
              onValueChange={value =>
                setThemeColor(value ? 'monochrome' : 'default')
              }
              {...props}
            />
          )}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>Data</List.Subheader>
        <List.Item
          title="Delete all conversations"
          description={`${conversationOrder.length} stored`}
          titleStyle={{ color: colors.error }}
          left={props => (
            <List.Icon
              {...props}
              icon="trash-can-outline"
              color={colors.error}
            />
          )}
          onPress={clearAll}
        />
        <List.Item
          title="Replay onboarding"
          left={props => <List.Icon {...props} icon="restart" />}
          onPress={() => setShowOnboarding(true)}
        />
      </List.Section>

      <Text style={[styles.footer, { color: colors.onSurfaceVariant }]}>
        &copy; whereismyai {new Date().getFullYear()}
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
  },
  footer: {
    textAlign: 'center',
    marginTop: 32,
  },
});

export default Settings;
