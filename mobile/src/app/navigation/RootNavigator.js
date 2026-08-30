import React, { useEffect, useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../../context/AuthContext';
import AuthStack from './AuthStack';
import CustomerTabs from './CustomerTabs';
import ShopTabs from './ShopTabs';
import WorkerTabs from './WorkerTabs';
import ChatScreen from '../../features/chat/ChatScreen';
import { View, ActivityIndicator } from 'react-native';
import Theme from '../../constants/Theme';
import { watchDeepLinksWhileLoggedOut } from '../../utils/deepLink';

const Stack = createStackNavigator();

const linking = {
  prefixes: ['kwickly://', 'https://kwickly.app'],
  config: {
    screens: {
      CustomerApp: {
        screens: {
          Home: 'home',
          Orders: 'orders',
          Profile: 'profile'
        }
      },
      WorkerApp: {
        screens: {
          Map: 'worker/map',
          Jobs: 'worker/jobs'
        }
      },
      ShopApp: {
        screens: {
          Dashboard: 'shop/dashboard',
          Orders: 'shop/orders'
        }
      },
      Chat: 'chat/:id',
    },
  },
};

export const navigationRef = createNavigationContainerRef();

const RootNavigator = () => {
  const { userToken, userRole, user, isLoading, pendingDeepLink, clearPendingDeepLink } = useAuth();
  const lastAppliedDeepLink = useRef(null);

  // While the user is logged out, watch for deep links to authenticated
  // routes and stash them for post-login redirect. The navigator itself only
  // registers authenticated screens when a token exists, so an
  // unauthenticated deep link cannot reach them and lands on Auth instead.
  const loggedOutRef = useRef(userToken == null);
  loggedOutRef.current = userToken == null;
  useEffect(() => {
    return watchDeepLinksWhileLoggedOut(() => loggedOutRef.current);
  }, []);

  // After login, redirect to a pending deep-link target if the logged-in
  // role can actually access it.
  useEffect(() => {
    if (userToken == null || !pendingDeepLink) return;
    if (lastAppliedDeepLink.current === pendingDeepLink) return;
    lastAppliedDeepLink.current = pendingDeepLink;
    if (navigationRef.isReady() && pendingDeepLink.role === userRole) {
      navigationRef.navigate(pendingDeepLink.app, {
        screen: pendingDeepLink.screen,
      });
    }
    clearPendingDeepLink();
  }, [userToken, userRole, pendingDeepLink, clearPendingDeepLink, user]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking} ref={navigationRef}>
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

