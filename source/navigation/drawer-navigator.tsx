import { createDrawerNavigator } from '@react-navigation/drawer';
import { Keyboard } from 'react-native';

import ConversationDrawer from './custom-drawer-content';
import ChatNavigator from './chat-navigator';
import type { DrawerParamList } from './types';

const Drawer = createDrawerNavigator<DrawerParamList>();

const DrawerNavigator = () => (
  <Drawer.Navigator
    drawerContent={props => <ConversationDrawer {...props} />}
    screenOptions={{
      headerShown: false,
      drawerType: 'slide',
      swipeEdgeWidth: 60,
    }}
  >
    <Drawer.Screen
      name="ChatStack"
      component={ChatNavigator}
      listeners={{ drawerItemPress: () => Keyboard.dismiss() }}
    />
  </Drawer.Navigator>
);

export default DrawerNavigator;
