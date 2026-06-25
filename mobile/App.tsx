import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/app/navigation/RootNavigator';
import Theme from './src/constants/Theme';

import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { NotificationProvider } from './src/context/NotificationContext';


function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
          <CartProvider>
            <AppContent />
          </CartProvider>
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}


function AppContent() {
  return (
    <SafeAreaProvider>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor={Theme.colors.background} 
      />
      <RootNavigator />
    </SafeAreaProvider>
  );
}

export default App;
