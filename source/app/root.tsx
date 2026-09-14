import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import BootSplash from 'react-native-bootsplash';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import AppProvider from './providers';
import ErrorBoundary from './error-boundary';
import { useIsDarkMode } from '@/features/settings';

function App() {
  const isDarkMode = useIsDarkMode();

  // The branded loading state behind this matches the native splash, so the
  // handover is invisible.
  useEffect(() => {
    void BootSplash.hide({ fade: true });
  }, []);

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
