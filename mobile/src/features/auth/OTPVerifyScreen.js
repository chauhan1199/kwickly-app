import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  StatusBar,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { ChevronLeft, MessageSquare, Smartphone } from 'lucide-react-native';
import CustomAlert from '../../components/ui/CustomAlert';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';

const OTPVerifyScreen = ({ navigation, route }) => {
  const { phone, role, otpMethod = 'SMS', fullName } = route.params || {};
  const [currentMethod, setCurrentMethod] = useState(otpMethod);
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
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
      if (inputs.current[nextIndex]) {
        inputs.current[nextIndex].focus();
      }
      return;
    }

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < 3 && inputs.current[index + 1]) {
      inputs.current[index + 1].focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0 && inputs.current[index - 1]) {
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
        await signIn(token, user?.role || role);
      }
    } catch (error) {
      const errDetails = error.response?.data?.errors?.join(', ') || error.response?.data?.message || 'Invalid verification code';
      showAlert('Verification Failed', errDetails, 'error');
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async (method) => {
    try {
      await api.post('/auth/send-otp', { phone, role, method });
      showAlert('OTP Sent', `A new verification code has been sent via ${method}`, 'success');
    } catch (error) {
      const errDetails = error.response?.data?.message || 'Failed to send OTP';
      showAlert('Error', errDetails);
    }
  };

  const handleResend = async () => {
    await sendOtp(currentMethod);
  };

  const toggleMethod = async () => {
    const nextMethod = currentMethod === 'SMS' ? 'WHATSAPP' : 'SMS';
    setCurrentMethod(nextMethod);
    await sendOtp(nextMethod);
  };

  const headerTopPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 8;
  const styles = createStyles(theme, isDarkMode, headerTopPad);

  const displayPhone = phone ? `${phone.substring(0, 4)}••••${phone.substring(8)}` : '••••••••••';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
        translucent={false}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ChevronLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verify OTP</Text>
          <View style={styles.headerRight}>
            <KwicklyIcon size={28} />
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.body}>
            <View style={[styles.iconWrapper, { backgroundColor: 'rgba(108, 71, 255, 0.12)' }]}>
              {currentMethod === 'WHATSAPP' ? (
                <Smartphone size={36} color="#10B981" />
              ) : (
                <MessageSquare size={36} color="#6C47FF" />
              )}
            </View>
            <Text style={styles.title}>Check your {currentMethod === 'WHATSAPP' ? 'WhatsApp' : 'messages'}</Text>
            <Text style={styles.subtitle}>OTP sent to <Text style={{fontWeight: '700', color: theme.colors.text}}>+91 {displayPhone}</Text></Text>

            <View style={styles.otpContainer}>
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (inputs.current[index] = ref)}
                  style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                  maxLength={4}
                  keyboardType="number-pad"
                  value={digit}
                  onChangeText={(text) => handleChange(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                />
              ))}
            </View>

            <View style={styles.bottomSpacer} />

            <TouchableOpacity style={styles.btnShadow} onPress={handleVerify} disabled={loading} activeOpacity={0.88}>
              <LinearGradient
                colors={['#7C3AED', '#6C47FF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.btnGradient}
              >
                <Text style={styles.btnText}>{loading ? 'Verifying...' : 'Verify & Continue →'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>Didn't receive code? </Text>
              <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
                <Text style={styles.resendAction}>Resend OTP</Text>
              </TouchableOpacity>
              <Text style={styles.resendText}> • </Text>
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
    </View>
  );
};

const createStyles = (theme, isDarkMode, headerTopPad) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: headerTopPad,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#1E293B' : '#EDF2F7',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: isDarkMode ? '#131B2E' : '#F1F4F9',
    borderWidth: 1,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },
  headerRight: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  stepDot: {
    width: 8,
    height: 6,
    borderRadius: 3,
    backgroundColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  stepDotDone: {
    width: 14,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  stepDotActive: {
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6C47FF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    padding: 20,
    flex: 1,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 76,
    height: 76,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    marginTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textDim,
    marginBottom: 28,
    textAlign: 'center',
    fontWeight: '500',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
    width: '100%',
  },
  otpInput: {
    width: 62,
    height: 62,
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderRadius: 16,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '900',
    color: theme.colors.text,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  otpInputFilled: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.1)' : '#F5F3FF',
    borderWidth: 2,
  },
  bottomSpacer: {
    flex: 1,
    minHeight: 24,
  },
  btnShadow: {
    width: '100%',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  btnGradient: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingBottom: 16,
  },
  resendText: {
    color: theme.colors.textDim,
    fontSize: 13,
    fontWeight: '500',
  },
  resendAction: {
    color: '#6C47FF',
    fontWeight: '800',
    fontSize: 13,
  },
  switchAction: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 13,
  }
});

export default OTPVerifyScreen;
