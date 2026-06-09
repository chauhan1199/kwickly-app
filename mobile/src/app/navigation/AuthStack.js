import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import RoleSelection from '../../features/auth/RoleSelection';
import LoginScreen from '../../features/auth/LoginScreen';
import OTPVerifyScreen from '../../features/auth/OTPVerifyScreen';
import SetPasswordScreen from '../../features/auth/SetPasswordScreen';
import SplashScreen from '../../features/auth/SplashScreen';
import Theme from '../../constants/Theme';

const Stack = createStackNavigator();

const AuthStack = () => {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: Theme.colors.background },
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="RoleSelection" component={RoleSelection} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OTPVerify" component={OTPVerifyScreen} />
      <Stack.Screen name="SetPassword" component={SetPasswordScreen} />
    </Stack.Navigator>
  );
};

export default AuthStack;
