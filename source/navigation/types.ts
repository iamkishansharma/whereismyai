import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DrawerScreenProps } from '@react-navigation/drawer';

export type RootStackParamList = {
  Onboarding: undefined;
  Main: NavigatorScreenParams<DrawerParamList> | undefined;
};

export type DrawerParamList = {
  ChatStack: NavigatorScreenParams<ChatStackParamList> | undefined;
};

export type ChatStackParamList = {
  Chat: { conversationId?: string } | undefined;
  Settings: undefined;
  ModelLibrary: undefined;
  ModelDetail: { modelId: string };
  GenerationSettings: { modelId?: string } | undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

type ChatStackScreenProps<T extends keyof ChatStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<ChatStackParamList, T>,
    CompositeScreenProps<
      DrawerScreenProps<DrawerParamList, 'ChatStack'>,
      NativeStackScreenProps<RootStackParamList, 'Main'>
    >
  >;

export type ChatScreenProps = ChatStackScreenProps<'Chat'>;
export type SettingsScreenProps = ChatStackScreenProps<'Settings'>;
export type ModelLibraryScreenProps = ChatStackScreenProps<'ModelLibrary'>;
export type ModelDetailScreenProps = ChatStackScreenProps<'ModelDetail'>;
export type GenerationSettingsScreenProps =
  ChatStackScreenProps<'GenerationSettings'>;

export type OnboardingScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Onboarding'
>;
