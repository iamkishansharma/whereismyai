import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { OnboardingScreen } from '@/features/onboarding';
import { useShowOnboarding } from '@/features/settings';
import DrawerNavigator from './drawer-navigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator = () => {
  const showOnboarding = useShowOnboarding();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {showOnboarding && (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      )}
      <Stack.Screen name="Main" component={DrawerNavigator} />
    </Stack.Navigator>
  );
};

export default RootNavigator;
