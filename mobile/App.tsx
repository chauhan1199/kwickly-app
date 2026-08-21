import React from 'react';
import { StatusBar, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/app/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { NotificationProvider } from './src/context/NotificationContext';
import OfflineBanner from './src/components/OfflineBanner';

function App() {
  LogBox.ignoreAllLogs();
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <NotificationProvider>
            <CartProvider>
              <AppContent />
            </CartProvider>
          </NotificationProvider>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const { theme, isDarkMode } = useTheme();

  return (
    <>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.colors.background} 
        translucent={false}
      />
      <OfflineBanner />
      <RootNavigator />
    </>
  );
}

export default App;
