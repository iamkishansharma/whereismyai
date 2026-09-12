import { Alert, Linking, ScrollView, StyleSheet } from 'react-native';
import {
  Divider,
  List,
  SegmentedButtons,
  Switch,
  Text,
  useTheme,
} from 'react-native-paper';

import { version as appVersion } from '../../../../app.json';
import { useShowGenerationStats, useThemeMode } from '../store';
import useChatStore from '@/features/chat/store';
import { useInstalledOrder } from '@/features/models/store';
import type { SettingsScreenProps } from '@/navigation/types';
import type { ThemeMode } from '@/types';

const SOURCE_URL = 'https://github.com/iamkishansharma/whereismyai';

const THEME_MODES: { value: ThemeMode; label: string; icon: string }[] = [
  { value: 'system', label: 'System', icon: 'cellphone' },
  { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
  { value: 'dark', label: 'Dark', icon: 'weather-night' },
];

const Settings = ({ navigation }: SettingsScreenProps) => {
  const { colors } = useTheme();
  const [themeMode, setThemeMode] = useThemeMode();
  const [showStats, setShowStats] = useShowGenerationStats();

  const installedCount = useInstalledOrder().length;
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
          style={styles.themeButtons}
          value={themeMode}
          onValueChange={value => setThemeMode(value as ThemeMode)}
          buttons={THEME_MODES}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>Models</List.Subheader>
        <List.Item
          title="Models"
          description={
            installedCount
              ? `${installedCount} installed · download, inspect and delete`
              : 'Download a model to start chatting'
          }
          left={props => (
            <List.Icon {...props} icon="folder-download-outline" />
          )}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('ModelLibrary')}
        />
        <List.Item
          title="Generation settings"
          description="System prompt, sampling and context window"
          left={props => <List.Icon {...props} icon="tune" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          // No modelId: the screen targets whichever model is selected, since
          // these settings are saved per model.
          onPress={() => navigation.navigate('GenerationSettings', {})}
        />
        <List.Item
          title="Show response details"
          description="Tokens, speed and time under each reply"
          left={props => <List.Icon {...props} icon="speedometer" />}
          right={() => (
            <Switch value={showStats} onValueChange={setShowStats} />
          )}
          onPress={() => setShowStats(!showStats)}
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
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>About</List.Subheader>
        <List.Item
          title="Version"
          description={appVersion}
          left={props => <List.Icon {...props} icon="information-outline" />}
        />
        <List.Item
          title="Source code"
          description="Open source under the GPLv3"
          left={props => <List.Icon {...props} icon="github" />}
          right={props => <List.Icon {...props} icon="open-in-new" />}
          onPress={() => void Linking.openURL(SOURCE_URL)}
        />
      </List.Section>

      <Text
        variant="bodySmall"
        style={[styles.footer, { color: colors.onSurfaceVariant }]}
      >
        Everything runs on this device. Nothing you type or attach is sent
        anywhere.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
  },
  themeButtons: {
    marginHorizontal: 16,
  },
  footer: {
    textAlign: 'center',
    marginTop: 24,
    marginHorizontal: 32,
  },
});

export default Settings;
