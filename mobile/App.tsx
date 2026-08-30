import React from 'react';
import { StatusBar, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/app/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { NotificationProvider } from './src/context/NotificationContext';
import OfflineBanner from './src/components/OfflineBanner';
import { initCrashReporting } from './src/utils/crashReporter';
import { warmUpBackend } from './src/services/api';

// Global JS error capture (no-op when ErrorUtils is unavailable).
initCrashReporting();

// Wake a sleeping backend instance now, so the user's first tap isn't the
// request that waits out the cold start.
warmUpBackend();

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
