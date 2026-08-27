import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DefaultStoreProps } from '@/types';

const useDefaultStore = create<DefaultStoreProps>()(
  persist(
    set => ({
      showOnboarding: false,
      setShowOnboarding: showOnboarding => set({ showOnboarding }),
      themeMode: 'light',
      setThemeMode: themeMode => set({ themeMode }),
      themeColor: 'monochrome',
      setThemeColor: themeColor => {
        set({ themeColor });
      },
    }),
    {
      name: 'default-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export default useDefaultStore;

/** Whether first-launch onboarding has been completed. */
export const useShowOnboarding = () =>
  useDefaultStore(state => state.showOnboarding);

/**
 * Read/write the theme preference ('system' | 'light' | 'dark').
 */
export function useThemeMode() {
  const themeMode = useDefaultStore(state => state.themeMode);
  const setThemeMode = useDefaultStore(state => state.setThemeMode);
  return [themeMode, setThemeMode] as const;
}

/**
 * Resolve the effective dark-mode flag, honouring the OS scheme
 * when the preference is 'system'.
 */
export function useIsDarkMode() {
  const themeMode = useDefaultStore(state => state.themeMode);
  const systemScheme = useColorScheme();

  if (themeMode === 'system') {
    return systemScheme === 'dark';
  }
  return themeMode === 'dark';
}
