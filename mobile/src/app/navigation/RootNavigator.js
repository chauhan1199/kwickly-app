import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../../context/AuthContext';
import AuthStack from './AuthStack';
import CustomerTabs from './CustomerTabs';
import ShopTabs from './ShopTabs';
import WorkerTabs from './WorkerTabs';
import ChatScreen from '../../features/chat/ChatScreen';
import { View, ActivityIndicator } from 'react-native';
import Theme from '../../constants/Theme';

const Stack = createStackNavigator();

const RootNavigator = () => {
  const { userToken, userRole, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {userToken == null ? (
          <Stack.Screen name="Auth" component={AuthStack} />
        ) : (
          userRole === 'CUSTOMER' ? (
            <Stack.Group>
              <Stack.Screen name="CustomerApp" component={CustomerTabs} />
              <Stack.Screen name="Chat" component={ChatScreen} />
            </Stack.Group>
          ) : userRole === 'SHOP' ? (
            <Stack.Group>
              <Stack.Screen name="ShopApp" component={ShopTabs} />
              <Stack.Screen name="Chat" component={ChatScreen} />
            </Stack.Group>
          ) : (
            /* WORKER — now has full tab navigator */
            <Stack.Group>
              <Stack.Screen name="WorkerApp" component={WorkerTabs} />
              <Stack.Screen name="Chat" component={ChatScreen} />
            </Stack.Group>
          )
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;

