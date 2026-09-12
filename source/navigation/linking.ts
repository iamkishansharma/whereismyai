import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'whereismyai://',
    'https://whereismyai.app',
    'https://whereismyai.github.io',
    'https://whereismyai.kishansharma.com.np',
  ],
  config: {
    initialRouteName: 'Main',
    screens: {
      Onboarding: 'welcome',
      Main: {
        screens: {
          ChatStack: {
            screens: {
              Chat: {
                path: 'chat/:conversationId?',
                parse: { conversationId: String },
              },
              Settings: 'settings',
              ModelLibrary: 'models',
              ModelDetail: 'models/:modelId',
              GenerationSettings: 'generation',
            },
          },
        },
      },
    },
  },
};
