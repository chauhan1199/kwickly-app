import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  Text, 
  StyleSheet, 
  TouchableOpacity 
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Eye, EyeOff } from 'lucide-react-native';

const Input = ({ 
  label, 
  error, 
  secureTextEntry, 
  iconLeft, 
  containerStyle,
  inputStyle,
  ...props 
}) => {
  const { theme, isDarkMode } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = secureTextEntry;
  const styles = createStyles(theme, isDarkMode);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View style={[
        styles.inputContainer,
        isFocused && styles.focused,
        error && styles.errorBorder,
      ]}>
        {iconLeft && <View style={styles.iconLeft}>{React.cloneElement(iconLeft, { color: isFocused ? theme.colors.primary : theme.colors.textMuted })}</View>}
        
        <TextInput
          style={[styles.input, inputStyle]}
          placeholderTextColor={theme.colors.textDim}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />

        {isPassword && (
          <TouchableOpacity 
            onPress={() => setShowPassword(!showPassword)}
            style={styles.iconRight}
          >
            {showPassword ? (
              <EyeOff size={20} color={theme.colors.textMuted} />
            ) : (
              <Eye size={20} color={theme.colors.textMuted} />
            )}
          </TouchableOpacity>
        )}
      </View>
      
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#333333' : '#d1d5db',
    paddingHorizontal: 16,
    height: 54,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '500',
    height: '100%',
  },
  focused: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
  },
  errorBorder: {
    borderColor: theme.colors.danger,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 12,
    marginTop: 4,
  },
  iconLeft: {
    marginRight: 10,
  },
  iconRight: {
    marginLeft: 10,
  },
});

export default Input;
