import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator,
  View
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

const Button = ({ 
  onPress, 
  title, 
  loading = false, 
  variant = 'primary', 
  size = 'md', 
  disabled = false,
  iconLeft,
  iconRight,
  style,
  textStyle
}) => {
  const { theme } = useTheme();
  
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';
  
  const getBackgroundColor = () => {
    if (disabled) return theme.colors.card;
    if (isOutline || isGhost) return 'transparent';
    if (variant === 'primary') return 'transparent'; // handled by gradient
    return theme.colors[variant] || theme.colors.primary;
  };

  const getBorderColor = () => {
    if (isOutline) return theme.colors[variant] || theme.colors.primary;
    return 'transparent';
  };

  const getTextColor = () => {
    if (disabled) return theme.colors.textDim;
    if (isOutline || isGhost) return theme.colors[variant] || theme.colors.primary;
    if (variant === 'primary') return theme.colors.white; // White text on primary gradient
    return theme.colors.white;
  };

  const styles = createStyles(theme);

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <View style={styles.content}>
          {iconLeft && <View style={styles.iconLeft}>{iconLeft}</View>}
          <Text style={[
            styles.text,
            styles[`text_${size}`],
            { color: getTextColor() },
            textStyle
          ]}>
            {title}
          </Text>
          {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
        </View>
      )}
    </>
  );

  const wrapperStyles = [
    styles.button,
    styles[size],
    { 
      backgroundColor: getBackgroundColor(),
      borderColor: getBorderColor(),
      borderWidth: isOutline ? 1 : 0,
    },
    style
  ];

  if (variant === 'primary' && !disabled && !isOutline && !isGhost) {
    return (
      <TouchableOpacity 
        onPress={onPress} 
        disabled={loading} 
        activeOpacity={0.8} 
        style={[styles.primaryShadow, { shadowColor: theme.colors.primary }]}
      >
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={wrapperStyles}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={wrapperStyles}
    >
      {content}
    </TouchableOpacity>
  );
};

const createStyles = (theme) => StyleSheet.create({
  button: {
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  primaryShadow: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderRadius: 14,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sizes
  sm: { paddingVertical: 8, paddingHorizontal: 16 },
  md: { paddingVertical: 16, paddingHorizontal: 24 },
  lg: { paddingVertical: 18, paddingHorizontal: 32 },
  
  text: {
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  text_sm: { fontSize: 14 },
  text_md: { fontSize: 16 },
  text_lg: { fontSize: 18 },
  
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
});

export default Button;
