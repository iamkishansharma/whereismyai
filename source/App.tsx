import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import AppProvider from './AppProvider';
import { useIsDarkMode } from './stores/default-store';

function App() {
  const isDarkMode = useIsDarkMode();

  return (
    <SafeAreaProvider>
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
        <GestureHandlerRootView>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <AppProvider />
        </GestureHandlerRootView>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

export default App;
