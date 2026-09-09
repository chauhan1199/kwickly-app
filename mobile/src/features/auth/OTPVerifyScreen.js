import React, { useState, useRef, useEffect } from 'react';
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
  ActivityIndicator,
  Keyboard,
  Dimensions
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const { width: SW, height: SH } = Dimensions.get('window');
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { 
  ChevronLeft, 
  MessageSquare, 
  Smartphone, 
  ShieldCheck, 
  Edit3, 
  RefreshCw 
} from 'lucide-react-native';
import CustomAlert from '../../components/ui/CustomAlert';
import api, { getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { validateOtpForSubmit, sanitizeOtp, OTP_LENGTH } from '../../utils/otpGuard';

const RESEND_COOLDOWN = 30;

const OTPVerifyScreen = ({ navigation, route }) => {
  const { phone, role, otpMethod = 'SMS', fullName } = route.params || {};
  const [currentMethod, setCurrentMethod] = useState(otpMethod);
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  
  const [code, setCode] = useState(['', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' });
  
  const inputs = useRef([]);
  const timerRef = useRef(null);

  // Keyboard avoidance state
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates?.height || 260);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const showAlert = (title, message, type = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const handleChange = (text, index) => {
    const digitOnly = sanitizeOtp(text).slice(0, 4);
    if (digitOnly.length > 1) {
      // Handle paste
      const pastedCode = digitOnly.slice(0, 4).split('');
      const newCode = [...code];
      pastedCode.forEach((char, i) => {
        if (index + i < 4) newCode[index + i] = char;
      });
      setCode(newCode);
      const nextIndex = Math.min(index + pastedCode.length, 3);
      if (inputs.current[nextIndex]) {
        inputs.current[nextIndex].focus();
      }
      if (newCode.every((d) => d.length === 1)) {
        handleVerify(newCode.join(''));
      }
      return;
    }

    const newCode = [...code];
    newCode[index] = digitOnly;
    setCode(newCode);

    if (text && index < 3 && inputs.current[index + 1]) {
      inputs.current[index + 1].focus();
      setFocusedIndex(index + 1);
    }

    // Auto verify once all 4 digits are entered
    if (digitOnly && index === 3 && newCode.every((d) => d.length === 1)) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!code[index] && index > 0 && inputs.current[index - 1]) {
        inputs.current[index - 1].focus();
        setFocusedIndex(index - 1);
      }
    }
  };

  const handleVerify = async (explicitCode = null) => {
    if (loading || sending) return;
    const codeToValidate = explicitCode ? explicitCode.split('') : code;
    const validation = validateOtpForSubmit(codeToValidate);
    if (!validation.valid) {
      showAlert('Invalid Code', validation.message);
      return;
    }
    const otpCode = validation.code;

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
        navigation.navigate('SetMpin', { phone, role, token, user, name: fullName || user?.name || 'User' });
      } else {
        await signIn(token, user?.role || role, user);
      }
    } catch (error) {
      const errDetails = getApiErrorMessage(error, 'Invalid verification code');
      showAlert('Verification Failed', errDetails, 'error');
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async (method) => {
    if (sending || loading) return;
    setSending(true);
    try {
      await api.post('/auth/send-otp', { phone, role, method });
      setCountdown(RESEND_COOLDOWN);
      setCode(['', '', '', '']);
      if (inputs.current[0]) inputs.current[0].focus();
      showAlert('OTP Sent', `A new verification code has been sent via ${method}`, 'success');
    } catch (error) {
      const errDetails = getApiErrorMessage(error, 'Failed to send OTP');
      showAlert('Error', errDetails);
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    await sendOtp(currentMethod);
  };

  const toggleMethod = async () => {
    const nextMethod = currentMethod === 'SMS' ? 'WHATSAPP' : 'SMS';
    setCurrentMethod(nextMethod);
    await sendOtp(nextMethod);
  };

  const headerTopPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 8;
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 16) + 20;
  const dynamicBottomPad = bottomPad + (keyboardVisible ? keyboardHeight + 20 : 0);
  const styles = createStyles(theme, isDarkMode, headerTopPad, dynamicBottomPad);

  const displayPhone = phone ? `${phone.substring(0, 4)}••••${phone.substring(8)}` : '••••••••••';
  const isComplete = code.every((digit) => digit.length === 1);

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0A0F1D' : '#F8FAFC' }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent={true}
      />

      {/* Atmospheric Ambient Glow Orbs */}
      <View style={styles.ambientContainer} pointerEvents="none">
        <View style={styles.orbTopRight}>
          <LinearGradient
            colors={['#6C47FF', '#3B82F6']}
            style={StyleSheet.fillObject}
          />
        </View>
        <View style={styles.orbBottomLeft}>
          <LinearGradient
            colors={['#7C3AED', '#10B981']}
            style={StyleSheet.fillObject}
          />
        </View>
      </View>
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ChevronLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerRight} />
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.body}>
            <View style={styles.verifyCard}>
              {/* Glowing Icon Badge */}
              <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.16)' : '#F5F3FF' }]}>
                {currentMethod === 'WHATSAPP' ? (
                  <Smartphone size={32} color="#10B981" />
                ) : (
                  <MessageSquare size={32} color="#6C47FF" />
                )}
              </View>

              {/* Title & Phone Pill */}
              <Text style={styles.title}>Check your {currentMethod === 'WHATSAPP' ? 'WhatsApp' : 'Messages'}</Text>
              
              <View style={styles.phonePillRow}>
                <Text style={styles.subtitle}>Code sent to </Text>
                <View style={styles.phonePill}>
                  <Text style={styles.phonePillText}>+91 {displayPhone}</Text>
                  <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 4 }}>
                    <Edit3 size={12} color="#6C47FF" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* 4-Digit OTP Inputs */}
              <View style={styles.otpContainer}>
                {code.map((digit, index) => {
                  const isFocused = focusedIndex === index;
                  const isFilled = digit.length > 0;
                  return (
                    <View 
                      key={index} 
                      style={[
                        styles.otpBoxWrapper,
                        isFocused && styles.otpBoxFocused,
                        isFilled && styles.otpBoxFilled,
                      ]}
                    >
                      <TextInput
                        ref={(ref) => (inputs.current[index] = ref)}
                        style={styles.otpInput}
                        maxLength={4}
                        keyboardType="number-pad"
                        autoFocus={index === 0}
                        selectTextOnFocus={true}
                        value={digit}
                        onChangeText={(text) => handleChange(text, index)}
                        onKeyPress={(e) => handleKeyPress(e, index)}
                        onFocus={() => setFocusedIndex(index)}
                        onBlur={() => setFocusedIndex(null)}
                      />
                    </View>
                  );
                })}
              </View>

              {/* Auto-read notice */}
              <View style={styles.securityNotice}>
                <ShieldCheck size={14} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={styles.securityNoticeText}>Auto-verifying your secure single-use OTP</Text>
              </View>

              {/* Verify & Continue Button */}
              <TouchableOpacity 
                style={[styles.btnShadow, { opacity: (isComplete && !loading) ? 1 : 0.65 }]} 
                onPress={() => handleVerify()} 
                disabled={!isComplete || loading || sending} 
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={['#7C3AED', '#6C47FF']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.btnGradient}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.btnText}>Verify & Continue →</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Resend & Alternative Channels */}
              <View style={styles.resendCard}>
                {countdown > 0 ? (
                  <View style={styles.timerRow}>
                    <RefreshCw size={13} color={theme.colors.textDim} style={{ marginRight: 6 }} />
                    <Text style={styles.timerText}>
                      Resend code in <Text style={styles.timerSeconds}>{countdown}s</Text>
                    </Text>
                  </View>
                ) : (
                  <View style={styles.resendActionsRow}>
                    <Text style={styles.resendPrompt}>Didn't receive code? </Text>
                    <TouchableOpacity onPress={handleResend} activeOpacity={0.7} disabled={sending || loading}>
                      <Text style={styles.resendLink}>
                        {sending ? 'Sending...' : 'Resend OTP'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.resendDivider}> • </Text>
                    <TouchableOpacity onPress={toggleMethod} activeOpacity={0.7} disabled={sending || loading}>
                      <Text style={styles.switchChannelLink}>
                        Try {currentMethod === 'WHATSAPP' ? 'SMS' : 'WhatsApp'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
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

const createStyles = (theme, isDarkMode, headerTopPad, bottomPad = 32) => StyleSheet.create({
  container: {
    flex: 1,
  },
  ambientContainer: {
    ...StyleSheet.fillObject,
    overflow: 'hidden',
  },
  orbTopRight: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: isDarkMode ? 0.18 : 0.12,
  },
  orbBottomLeft: {
    position: 'absolute',
    bottom: SH * 0.15,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: isDarkMode ? 0.15 : 0.09,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: headerTopPad,
    paddingBottom: 2,
    borderBottomWidth: 0,
    zIndex: 3,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRight: {
    width: 40,
    height: 40,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: bottomPad,
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 10,
    width: '100%',
    alignItems: 'center',
  },
  verifyCard: {
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: 22,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  iconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(108, 71, 255, 0.3)' : '#EDE9FE',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 4,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  phonePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  phonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  phonePillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.colors.text,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
    width: '100%',
  },
  otpBoxWrapper: {
    width: 58,
    height: 60,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  otpBoxFocused: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.12)' : '#F5F3FF',
    borderWidth: 2,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  otpBoxFilled: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? '#1E1B4B' : '#FAF5FF',
  },
  otpInput: {
    width: '100%',
    height: '100%',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    padding: 0,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
    marginBottom: 16,
  },
  securityNoticeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#10B981',
  },
  btnShadow: {
    width: '100%',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 5,
    borderRadius: 16,
    marginBottom: 12,
  },
  btnGradient: {
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  resendCard: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 13.5,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  timerSeconds: {
    color: '#6C47FF',
    fontWeight: '800',
  },
  resendActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  resendPrompt: {
    color: theme.colors.textDim,
    fontSize: 13.5,
    fontWeight: '500',
  },
  resendLink: {
    color: '#6C47FF',
    fontWeight: '800',
    fontSize: 13.5,
  },
  resendDivider: {
    color: theme.colors.textDim,
    fontSize: 13.5,
  },
  switchChannelLink: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 13.5,
  },
});

export default OTPVerifyScreen;
