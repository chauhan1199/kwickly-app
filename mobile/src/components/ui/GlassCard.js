import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Theme from '../../constants/Theme';

const GlassCard = ({
  children,
  style,
  onPress,
  padding = 'md',
  isDarkMode = false
}) => {
  const getPadding = () => {
    return { padding: Theme.spacing[padding] || Theme.spacing.md };
  };

  const Component = onPress ? TouchableOpacity : View;

  // A subtle translucent background mimicking glassmorphism
  const glassStyle = {
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)',
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.5)',
  };

  return (
    <Component
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.base,
        glassStyle,
        getPadding(),
        style
      ]}
    >
      {children}
    </Component>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: Theme.radius.lg,
    width: '100%',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2 // Android shadow
  }
});

export default GlassCard;
