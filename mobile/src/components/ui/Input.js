import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  Text, 
  StyleSheet, 
  TouchableOpacity 
} from 'react-native';
import Theme from '../../constants/Theme';
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
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = secureTextEntry;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View style={[
        styles.inputContainer,
        isFocused && styles.focused,
        error && styles.errorBorder,
      ]}>
        {iconLeft && <View style={styles.iconLeft}>{iconLeft}</View>}
        
        <TextInput
          style={[styles.input, inputStyle]}
          placeholderTextColor={Theme.colors.textDim}
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
              <EyeOff size={20} color={Theme.colors.textMuted} />
            ) : (
              <Eye size={20} color={Theme.colors.textMuted} />
            )}
          </TouchableOpacity>
        )}
      </View>
      
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: Theme.spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textMuted,
    marginBottom: 6,
    marginLeft: 0,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: Theme.colors.text,
    fontSize: 14,
    fontWeight: '500',
    fontFamily: Theme.typography.fontFamily,
  },
  focused: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.surface,
  },
  errorBorder: {
    borderColor: Theme.colors.danger,
  },
  errorText: {
    color: Theme.colors.danger,
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
