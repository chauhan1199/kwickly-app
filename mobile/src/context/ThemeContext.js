import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightTheme, DarkTheme } from '../constants/Theme';

const ThemeContext = createContext();

const THEME_STORAGE_KEY = '@kwickly_theme_mode';

export const ThemeProvider = ({ children }) => {
  // Default to clean modern Light theme
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then(saved => {
        if (saved !== null) {
          setIsDarkMode(saved === 'dark');
        }
      })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      AsyncStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light').catch(() => {});
      return next;
    });
  };

  const setThemeMode = (mode) => {
    const isDark = mode === 'dark';
    setIsDarkMode(isDark);
    AsyncStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light').catch(() => {});
  };

  const theme = isDarkMode ? DarkTheme : LightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode, toggleTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
