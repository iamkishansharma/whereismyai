import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { Theme } from '@react-navigation/native';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';

import useDefaultStore, { useIsDarkMode } from './stores/default-store';
import { RootNavigator, linking } from '@/navigation';
import DatabaseGate from '@/db/DatabaseGate';
import { getThemeBasedOnColor } from './utils';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

const LinkingFallback = () => (
  <View style={styles.fallback}>
    <ActivityIndicator />
  </View>
);

function AppProvider() {
  const isDarkMode = useIsDarkMode();
  const themeColor = useDefaultStore(state => state.themeColor);
  const paperTheme = isDarkMode
    ? getThemeBasedOnColor(themeColor)?.dark
    : getThemeBasedOnColor(themeColor)?.light;

  const navigationBase = isDarkMode ? DarkTheme : DefaultTheme;
  const theme: Theme = {
    ...navigationBase,
    dark: isDarkMode,
    colors: {
      ...navigationBase.colors,
      background: paperTheme.colors.background,
      card: paperTheme.colors.surface,
      text: paperTheme.colors.onSurface,
      border: paperTheme.colors.outline,
      notification: paperTheme.colors.primary,
      primary: paperTheme.colors.primary,
    },
  };

  return (
    <PaperProvider theme={paperTheme}>
      <DatabaseGate>
        <BottomSheetModalProvider>
        <NavigationContainer
          theme={theme}
          linking={linking}
          fallback={<LinkingFallback />}
        >
          <RootNavigator />
        </NavigationContainer>
        </BottomSheetModalProvider>
      </DatabaseGate>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AppProvider;
