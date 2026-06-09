import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TextInput,
  StatusBar,
  ScrollView
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { ChevronLeft } from 'lucide-react-native';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const OTPVerifyScreen = ({ navigation, route }) => {
  const { phone, role, otpMethod = 'SMS' } = route.params || {};
  const [currentMethod, setCurrentMethod] = useState(otpMethod);
  const { theme, isDarkMode } = useTheme();
  const { signIn } = useAuth();
  
  const [code, setCode] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputs = useRef([]);

  const handleChange = (text, index) => {
    if (text.length > 1) {
      // Handle paste
      const pastedCode = text.slice(0, 4).split('');
      const newCode = [...code];
      pastedCode.forEach((char, i) => {
        if (index + i < 4) newCode[index + i] = char;
      });
      setCode(newCode);
      const nextIndex = Math.min(index + pastedCode.length, 3);
      inputs.current[nextIndex].focus();
      return;
    }

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < 3) {
      inputs.current[index + 1].focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1].focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = code.join('');
    if (otpCode.length < 4) {
      Alert.alert('Incomplete Code', 'Please enter the 4-digit verification code');
      return;
    }

    setLoading(true);
    try {
      // Verify via backend
      const response = await api.post('/auth/verify-otp', {
        phone,
        code: otpCode,
        role
      });
      
      const { token, isNew, user } = response.data.data;
      
      if (isNew) {
        navigation.navigate('SetPassword', { phone, role, token, user });
      } else {
        await signIn(token, user.role || role);
      }
    } catch (error) {
      const errDetails = error.response?.data?.errors?.join(', ') || error.response?.data?.message || 'Invalid verification code';
      Alert.alert('Error', errDetails);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    Alert.alert('OTP Sent', `A new code has been sent via ${currentMethod}`);
  };

  const toggleMethod = () => {
    const nextMethod = currentMethod === 'SMS' ? 'WHATSAPP' : 'SMS';
    setCurrentMethod(nextMethod);
    Alert.alert('Switched', `Switched to ${nextMethod}`);
  };

  const styles = createStyles(theme);

  const displayPhone = phone ? `${phone.substring(0,5)}XXXXX` : '92743XXXXX';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      
      {/* Header exactly like prototype */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verify OTP</Text>
          <View style={{width: 36}} />
        </View>
        <View style={styles.stepDots}>
          <View style={[styles.stepDot, styles.stepDotDone]} />
          <View style={[styles.stepDot, styles.stepDotDone]} />
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={styles.stepDot} />
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.body}>
            <Text style={styles.emojiIcon}>{currentMethod === 'WHATSAPP' ? '💬' : '📱'}</Text>
            <Text style={styles.title}>Check your {currentMethod === 'WHATSAPP' ? 'WhatsApp' : 'messages'}</Text>
            <Text style={styles.subtitle}>OTP sent to <Text style={{fontWeight: 'bold', color: theme.colors.text}}>+91 {displayPhone}</Text></Text>
            <Text style={styles.demoText}>(Demo OTP: <Text style={{color: theme.colors.primary, fontWeight: 'bold'}}>4 7 2 9</Text>)</Text>

            <View style={styles.otpContainer}>
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (inputs.current[index] = ref)}
                  style={[styles.otpInput, digit && styles.otpInputFilled]}
                  maxLength={4} // Handle paste
                  keyboardType="number-pad"
                  value={digit}
                  onChangeText={(text) => handleChange(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                />
              ))}
            </View>

            <TouchableOpacity style={styles.btn} onPress={handleVerify} disabled={loading}>
              <Text style={styles.btnText}>{loading ? 'Verifying...' : 'Verify & Continue →'}</Text>
            </TouchableOpacity>

            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>Didn't get it? </Text>
              <TouchableOpacity onPress={handleResend}>
                <Text style={styles.resendAction}>Resend OTP</Text>
              </TouchableOpacity>
              <Text style={styles.resendText}> or </Text>
              <TouchableOpacity onPress={toggleMethod}>
                <Text style={styles.switchAction}>Try {currentMethod === 'WHATSAPP' ? 'SMS' : 'WhatsApp'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: theme.colors.background,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.border,
  },
  stepDotDone: {
    backgroundColor: theme.colors.text,
  },
  stepDotActive: {
    width: 24,
    backgroundColor: theme.colors.primary,
  },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    padding: 16,
    alignItems: 'center',
    paddingTop: 20,
  },
  emojiIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textDim,
    marginBottom: 8,
    textAlign: 'center',
  },
  demoText: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginBottom: 32,
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
    width: '100%',
  },
  otpInput: {
    width: 60,
    height: 60,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
  },
  otpInputFilled: {
    borderColor: theme.colors.primary,
  },
  btn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
  },
  btnText: {
    color: '#001016',
    fontWeight: '700',
    fontSize: 15,
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  resendText: {
    color: theme.colors.textDim,
    fontSize: 14,
  },
  resendAction: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  switchAction: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 14,
  }
});

export default OTPVerifyScreen;
