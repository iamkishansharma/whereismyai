import { useColorScheme } from 'react-native';
import { create } from 'zustand';

import { loadAppState, saveAppState } from '@/core/db/app-state-repository';
import type { ThemeMode } from '@/types';

interface SettingsStore {
  hydrated: boolean;
  showOnboarding: boolean;
  themeMode: ThemeMode;
  /** Whether replies show what they cost — tokens, speed, time. */
  showGenerationStats: boolean;
  hydrate: () => Promise<void>;
  setShowOnboarding: (done: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setShowGenerationStats: (show: boolean) => void;
}

/**
 * Backed by the `app_state` row rather than AsyncStorage, so the whole app has
 * one store and one migration story. Defaults apply until `hydrate` resolves —
 * the theme is read before the database gate opens.
 */
const useSettingsStore = create<SettingsStore>()((set, get) => ({
  hydrated: false,
  showOnboarding: true,
  themeMode: 'system',
  showGenerationStats: false,

  hydrate: async () => {
    if (get().hydrated) {
      return;
    }
    const state = await loadAppState();
    set({
      hydrated: true,
      showOnboarding: !state.onboardingDone,
      themeMode: state.themeMode,
      showGenerationStats: state.showGenerationStats,
    });
  },

  setShowOnboarding: showOnboarding => {
    set({ showOnboarding });
    void saveAppState({ onboardingDone: !showOnboarding });
  },

  setThemeMode: themeMode => {
    set({ themeMode });
    void saveAppState({ themeMode });
  },

  setShowGenerationStats: showGenerationStats => {
    set({ showGenerationStats });
    void saveAppState({ showGenerationStats });
  },
}));

export default useSettingsStore;

/** Whether first-launch onboarding has been completed. */
export const useShowOnboarding = () =>
  useSettingsStore(state => state.showOnboarding);

export function useThemeMode() {
  const themeMode = useSettingsStore(state => state.themeMode);
  const setThemeMode = useSettingsStore(state => state.setThemeMode);
  return [themeMode, setThemeMode] as const;
}

export function useShowGenerationStats() {
  const show = useSettingsStore(state => state.showGenerationStats);
  const setShow = useSettingsStore(state => state.setShowGenerationStats);
  return [show, setShow] as const;
}

export function useIsDarkMode() {
  const scheme = useColorScheme();
  const themeMode = useSettingsStore(state => state.themeMode);
  return themeMode === 'system' ? scheme === 'dark' : themeMode === 'dark';
}
