import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import AppProvider from './providers';
import ErrorBoundary from './error-boundary';
import { useIsDarkMode } from '@/features/settings';

function App() {
  const isDarkMode = useIsDarkMode();

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
          <GestureHandlerRootView>
            <StatusBar
              barStyle={isDarkMode ? 'light-content' : 'dark-content'}
            />
            <AppProvider />
          </GestureHandlerRootView>
        </KeyboardProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default App;
