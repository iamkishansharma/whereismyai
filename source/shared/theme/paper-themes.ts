import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

import type { ThemeColor } from '@/types';
import { WIMATheme } from './palette';

/** The light/dark Paper theme pair for the chosen colour scheme. */
export function getThemeBasedOnColor(color?: ThemeColor) {
  switch (color) {
    case 'monochrome':
      return WIMATheme;
    default:
      return { light: MD3LightTheme, dark: MD3DarkTheme };
  }
}
