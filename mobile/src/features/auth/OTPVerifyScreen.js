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
  ScrollView,
  Image
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { ChevronLeft } from 'lucide-react-native';
import CustomAlert from '../../components/ui/CustomAlert';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const OTPVerifyScreen = ({ navigation, route }) => {
  const { phone, role, otpMethod = 'SMS', fullName } = route.params || {};
  const [currentMethod, setCurrentMethod] = useState(otpMethod);
  const { theme, isDarkMode } = useTheme();
  const { signIn } = useAuth();
  
  const [code, setCode] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' });
  const inputs = useRef([]);

  const showAlert = (title, message, type = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

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
      showAlert('Incomplete Code', 'Please enter the 4-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      // Verify via backend
      const response = await api.post('/auth/verify-otp', {
        phone,
        code: otpCode,
        role,
        name: fullName
      });
      
      const { token, isNew, user } = response.data.data;
      
      if (isNew) {
        navigation.navigate('SetPassword', { phone, role, token, user, name: fullName });
      } else {
        await signIn(token, user.role || role);
      }
    } catch (error) {
      const errDetails = error.response?.data?.errors?.join(', ') || error.response?.data?.message || 'Invalid verification code';
      showAlert('Verification Failed', errDetails, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    showAlert('OTP Sent', `A new code has been sent via ${currentMethod}`, 'success');
  };

  const toggleMethod = () => {
    const nextMethod = currentMethod === 'SMS' ? 'WHATSAPP' : 'SMS';
    setCurrentMethod(nextMethod);
    showAlert('Switched', `Switched to ${nextMethod}`, 'success');
  };

  const styles = createStyles(theme, isDarkMode);

  const displayPhone = phone ? `${phone.substring(0,5)}XXXXX` : '92743XXXXX';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      
      {/* Header exactly matching RoleSelection */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft size={22} color={isDarkMode ? '#fff' : '#111'} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verify OTP</Text>
          <View style={styles.headerRight}>
            <Image source={require('../../assets/images/logo.jpeg')} style={styles.headerLogo} />
          </View>
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
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.body}>
            <View style={styles.iconWrapper}>
              <Text style={styles.emojiIcon}>{currentMethod === 'WHATSAPP' ? '💬' : '📱'}</Text>
            </View>
            <Text style={styles.title}>Check your {currentMethod === 'WHATSAPP' ? 'WhatsApp' : 'messages'}</Text>
            <Text style={styles.subtitle}>OTP sent to <Text style={{fontWeight: '700', color: theme.colors.text}}>+91 {displayPhone}</Text></Text>
            <Text style={styles.demoText}>(Demo OTP: <Text style={{color: '#6C47FF', fontWeight: '800'}}>1 2 3 4</Text>)</Text>

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

            <View style={styles.bottomSpacer} />

            <TouchableOpacity style={styles.btnShadow} onPress={handleVerify} disabled={loading} activeOpacity={0.8}>
              <LinearGradient
                colors={['#8B5CF6', '#6C47FF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.btnGradient}
              >
                <Text style={styles.btnText}>{loading ? 'Verifying...' : 'Verify & Continue →'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>Didn't get it? </Text>
              <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
                <Text style={styles.resendAction}>Resend OTP</Text>
              </TouchableOpacity>
              <Text style={styles.resendText}> or </Text>
              <TouchableOpacity onPress={toggleMethod} activeOpacity={0.7}>
                <Text style={styles.switchAction}>Try {currentMethod === 'WHATSAPP' ? 'SMS' : 'WhatsApp'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomAlert 
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 16 : 16,
    paddingBottom: 4,
    backgroundColor: theme.colors.background,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#333' : '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  headerRight: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  headerLogo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius: 16,
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: isDarkMode ? '#333' : '#e5e7eb',
  },
  stepDotDone: {
    backgroundColor: isDarkMode ? '#888' : '#6b7280',
  },
  stepDotActive: {
    width: 28,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6C47FF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    padding: 24,
    flex: 1,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: '#6C47FF15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emojiIcon: {
    fontSize: 44,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textDim,
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  demoText: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginBottom: 40,
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 32,
    width: '100%',
  },
  otpInput: {
    width: 68,
    height: 68,
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#333' : '#e5e7eb',
    backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
    borderRadius: 20,
    textAlign: 'center',
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.text,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  otpInputFilled: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.08)' : '#f8f7ff',
    borderWidth: 2,
  },
  bottomSpacer: {
    flex: 1,
    minHeight: 24,
  },
  btnShadow: {
    width: '100%',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    borderRadius: 20,
    marginBottom: 24,
  },
  btnGradient: {
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.5,
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingBottom: 20,
  },
  resendText: {
    color: theme.colors.textDim,
    fontSize: 14,
    fontWeight: '500',
  },
  resendAction: {
    color: '#6C47FF',
    fontWeight: '800',
    fontSize: 14,
  },
  switchAction: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 14,
  }
});

export default OTPVerifyScreen;
