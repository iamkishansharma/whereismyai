import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useShowOnboarding } from '@/stores/default-store';
import Onboarding from '@/screens/onboarding';
import DrawerNavigator from './drawer-navigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator = () => {
  const showOnboarding = useShowOnboarding();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {showOnboarding && (
        <Stack.Screen name="Onboarding" component={Onboarding} />
      )}
      <Stack.Screen name="Main" component={DrawerNavigator} />
    </Stack.Navigator>
  );
};

export default RootNavigator;
