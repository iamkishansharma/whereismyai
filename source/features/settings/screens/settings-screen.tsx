import { Alert, ScrollView, StyleSheet } from 'react-native';
import { Chip, Divider, List, Menu, Text, useTheme } from 'react-native-paper';

import useSettingsStore, { useThemeMode } from '../store';
import useChatStore from '@/features/chat/store';
import type { ThemeMode } from '@/types';
import { useState } from 'react';

const THEME_MODES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const Settings = () => {
  const { colors } = useTheme();
  const [themeMode, setThemeMode] = useThemeMode();
  // const themeColor = useSettingsStore(state => state.themeColor);
  // const setThemeColor = useSettingsStore(state => state.setThemeColor);
  const setShowOnboarding = useSettingsStore(state => state.setShowOnboarding);

  const conversationOrder = useChatStore(state => state.conversationOrder);
  const deleteConversation = useChatStore(state => state.deleteConversation);

  const [showMenu, setShowMenu] = useState(false);

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
        <List.Item
          title="Theme Mode"
          description={themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}
          left={props => <List.Icon {...props} icon="theme-light-dark" />}
          right={props => (
            <Menu
              visible={showMenu}
              onDismiss={() => setShowMenu(false)}
              anchor={
                <Chip onPress={() => setShowMenu(true)} {...props}>
                  {themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}
                </Chip>
              }
              contentStyle={{ borderRadius: 20 }}
              anchorPosition="bottom"
            >
              {THEME_MODES.map(mode => (
                <Menu.Item
                  key={mode.value}
                  leadingIcon={
                    mode.value === 'system'
                      ? 'cellphone'
                      : mode.value === 'light'
                      ? 'white-balance-sunny'
                      : 'weather-night'
                  }
                  onPress={() => {
                    setThemeMode(mode.value);
                    setShowMenu(false);
                  }}
                  title={mode.label}
                />
              ))}
            </Menu>
          )}
          onPress={() => {
            setShowMenu(true);
          }}
        />

        {/* <List.Item
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
        /> */}
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
