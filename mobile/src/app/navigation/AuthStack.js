import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import AppSplashScreen from '../../features/auth/AppSplashScreen';
import WelcomeScreen from '../../features/auth/WelcomeScreen';
import RoleSelection from '../../features/auth/RoleSelection';
import LoginScreen from '../../features/auth/LoginScreen';
import OTPVerifyScreen from '../../features/auth/OTPVerifyScreen';
import SetPasswordScreen from '../../features/auth/SetPasswordScreen';
import ForgotPasswordScreen from '../../features/auth/ForgotPasswordScreen';
import { useTheme } from '../../context/ThemeContext';

const Stack = createStackNavigator();

const AuthStack = () => {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="AppSplash"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="AppSplash" component={AppSplashScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Splash" component={WelcomeScreen} />
      <Stack.Screen name="RoleSelection" component={RoleSelection} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OTPVerify" component={OTPVerifyScreen} />
      <Stack.Screen name="SetPassword" component={SetPasswordScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
};

export default AuthStack;
