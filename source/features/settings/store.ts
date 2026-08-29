import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ThemeColor, ThemeMode } from '@/types';

interface SettingsStore {
  showOnboarding: boolean;
  setShowOnboarding: (done: boolean) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
}

const useSettingsStore = create<SettingsStore>()(
  persist(
    set => ({
      showOnboarding: true,
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

export default useSettingsStore;

/** Whether first-launch onboarding has been completed. */
export const useShowOnboarding = () =>
  useSettingsStore(state => state.showOnboarding);

/**
 * Read/write the theme preference ('system' | 'light' | 'dark').
 */
export function useThemeMode() {
  const themeMode = useSettingsStore(state => state.themeMode);
  const setThemeMode = useSettingsStore(state => state.setThemeMode);
  return [themeMode, setThemeMode] as const;
}

/**
 * Resolve the effective dark-mode flag, honouring the OS scheme
 * when the preference is 'system'.
 */
export function useIsDarkMode() {
  const themeMode = useSettingsStore(state => state.themeMode);
  const systemScheme = useColorScheme();

  if (themeMode === 'system') {
    return systemScheme === 'dark';
  }
  return themeMode === 'dark';
}
