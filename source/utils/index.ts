import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { WIMATheme } from '@/theme';
import type { ThemeColor } from '@/types';
import { Platform } from 'react-native';

export function getThemeBasedOnColor(color?: ThemeColor) {
  switch (color) {
    case 'monochrome':
      return WIMATheme;
    default:
      return { light: MD3LightTheme, dark: MD3DarkTheme };
  }
}

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
