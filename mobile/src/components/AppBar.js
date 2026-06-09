import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Bell, Moon, Sun } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

const AppBar = ({ 
  title, 
  subtitle,
  showBack = false, 
  onBackPress, 
  rightActions = true,
  onNotificationPress
}) => {
  const navigation = useNavigation();
  const { theme, isDarkMode, toggleTheme } = useTheme();
  
  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      <View style={styles.leftContainer}>
        {showBack && (
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9' }]} onPress={handleBack}>
            <ChevronLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
        )}
        <View style={{ marginLeft: showBack ? 12 : 4 }}>
          {title && (
            <Text style={[styles.title, { 
              color: theme.colors.text, 
              fontSize: showBack ? 20 : 28, 
              fontWeight: showBack ? '800' : '900' 
            }]}>
              {title}
            </Text>
          )}
          {subtitle && (
            <Text style={{ fontSize: showBack ? 13 : 15, color: '#64748b', marginTop: 2 }}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {rightActions && (
        <View style={styles.rightContainer}>
          <TouchableOpacity style={styles.iconBtn} onPress={toggleTheme}>
            {isDarkMode ? (
              <Sun size={22} color={theme.colors.text} />
            ) : (
              <Moon size={22} color={theme.colors.text} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.iconBtn} onPress={onNotificationPress}>
            <Bell size={24} color={theme.colors.text} />
            <View style={[styles.badge, { backgroundColor: '#f59e0b', borderColor: theme.colors.background }]} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  }
});

export default AppBar;
