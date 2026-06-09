import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator,
  View
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Theme from '../../constants/Theme';

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
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';
  
  const getBackgroundColor = () => {
    if (disabled) return Theme.colors.card;
    if (isOutline || isGhost) return 'transparent';
    if (variant === 'primary') return 'transparent'; // handled by gradient
    return Theme.colors[variant] || Theme.colors.primary;
  };

  const getBorderColor = () => {
    if (isOutline) return Theme.colors[variant] || Theme.colors.primary;
    return 'transparent';
  };

  const getTextColor = () => {
    if (disabled) return Theme.colors.textDim;
    if (isOutline || isGhost) return Theme.colors[variant] || Theme.colors.primary;
    if (variant === 'primary') return Theme.colors.black; // Text color on primary gradient
    return Theme.colors.white;
  };

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
      <TouchableOpacity onPress={onPress} disabled={loading} activeOpacity={0.8} style={{borderRadius: 12}}>
        <LinearGradient
          colors={['#0e9aa7', '#43e3eb']}
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

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sizes
  sm: { paddingVertical: 8, paddingHorizontal: 16 },
  md: { paddingVertical: 14, paddingHorizontal: 24 },
  lg: { paddingVertical: 18, paddingHorizontal: 32 },
  
  text: {
    fontFamily: Theme.typography.fontFamily,
    fontWeight: '800',
    textAlign: 'center',
  },
  text_sm: { fontSize: Theme.typography.sizes.sm },
  text_md: { fontSize: Theme.typography.sizes.md },
  text_lg: { fontSize: Theme.typography.sizes.lg },
  
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
});

export default Button;
