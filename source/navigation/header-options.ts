import { isIOS } from '@/shared/utils';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

export const plainHeaderOptions: NativeStackNavigationOptions = {
  headerShadowVisible: false,
  headerTitleAlign: 'center',
  ...(isIOS ? { headerBackButtonDisplayMode: 'minimal' as const } : null),
};

export const transparentHeaderOptions: NativeStackNavigationOptions = isIOS
  ? {
      headerTransparent: true,
      headerShadowVisible: false,
    }
  : { headerShadowVisible: false };
