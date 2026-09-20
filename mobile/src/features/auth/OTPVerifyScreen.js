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
  ActivityIndicator,
  Keyboard,
  Dimensions,
  ScrollView,
  useWindowDimensions,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import {
  MessageSquare,
  Smartphone,
  ShieldCheck,
  Edit3,
  RefreshCw,
  Sparkles,
  ArrowRight,
} from 'lucide-react-native';
import CustomAlert from '../../components/ui/CustomAlert';
import api, { getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';
import { validateOtpForSubmit, sanitizeOtp } from '../../utils/otpGuard';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';
import { getSafeBottomInset, getSafeTopInset } from '../../utils/safeInsets';

const PURPLE = '#6C47FF';
const RESEND_COOLDOWN = 30;

const OTPVerifyScreen = ({ navigation, route }) => {
  const { phone, role, otpMethod = 'SMS', fullName } = route.params || {};
  const [currentMethod, setCurrentMethod] = useState(otpMethod);
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isSmallScreen = windowHeight < 760;
  const isTallScreen = windowHeight >= 820;
  const { signIn } = useAuth();

  const [code, setCode] = useState(['', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' });

  const inputs = useRef([]);
  const timerRef = useRef(null);
  const scrollRef = useRef(null);

  const { keyboardVisible, keyboardHeight, bottomInset } = useKeyboardBottomInset(30);
  const topSectionDynamicStyle = null;
  const cardDynamicStyle = null;

  useEffect(() => {
    const t = setTimeout(() => { if (inputs.current[0]) inputs.current[0].focus(); }, 350);
    timerRef.current = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => { clearTimeout(t); clearInterval(timerRef.current); };
  }, []);

  const showAlert = (title, message, type = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const handleChange = (text, index) => {
    const digitOnly = sanitizeOtp(text).slice(0, 4);
    if (digitOnly.length > 1) {
      const chars = digitOnly.split('');
      const newCode = [...code];
      chars.forEach((ch, i) => { if (index + i < 4) newCode[index + i] = ch; });
      setCode(newCode);
      const nextIdx = Math.min(index + chars.length, 3);
      if (inputs.current[nextIdx]) inputs.current[nextIdx].focus();
      if (newCode.every(d => d.length === 1)) handleVerify(newCode.join(''));
      return;
    }
    const newCode = [...code];
    newCode[index] = digitOnly;
    setCode(newCode);
    if (digitOnly && index < 3 && inputs.current[index + 1]) {
      inputs.current[index + 1].focus();
      setFocusedIndex(index + 1);
    }
    if (digitOnly && index === 3 && newCode.every(d => d.length === 1)) handleVerify(newCode.join(''));
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0 && inputs.current[index - 1]) {
      inputs.current[index - 1].focus();
      setFocusedIndex(index - 1);
    }
  };

  const handleVerify = async (explicitCode = null) => {
    if (loading || sending) return;
    const codeArr = (typeof explicitCode === 'string' && explicitCode.length === 4) ? explicitCode.split('') : code;
    const validation = validateOtpForSubmit(codeArr);
    if (!validation.valid) { showAlert('Invalid Code', validation.message); return; }
    const otpCode = validation.code;
    setLoading(true);
    try {
      const response = await api.post('/auth/verify-otp', {
        phone,
        code: otpCode,
        role,
        name: fullName,
      });
      const { token, isNew, user } = response.data.data;
      if (isNew) {
        navigation.navigate('SetMpin', {
          phone, role, token, user,
          name: fullName || user?.name || 'User',
        });
      } else {
        await signIn(token, user?.role || role, user);
      }
    } catch (error) {
      showAlert('Verification Failed', getApiErrorMessage(error, 'Invalid or expired verification code.'), 'error');
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
      showAlert('OTP Sent', `New code sent via ${method === 'WHATSAPP' ? 'WhatsApp' : 'SMS'}`, 'success');
    } catch (error) {
      showAlert('Error', getApiErrorMessage(error, 'Failed to send OTP.'));
    } finally {
      setSending(false);
    }
  };

  const handleResend = () => { if (countdown > 0) return; sendOtp(currentMethod); };
  const toggleMethod = () => {
    const next = currentMethod === 'SMS' ? 'WHATSAPP' : 'SMS';
    setCurrentMethod(next);
    sendOtp(next);
  };

  const safeTopPadding = getSafeTopInset(insets, 14);
  const safeBottomInset = getSafeBottomInset(insets, 10);

  const cardBg = isDarkMode ? '#131B2E' : '#FFFFFF';
  const cardBorder = isDarkMode ? '#1E293B' : '#EDF0F7';
  const textMain = isDarkMode ? '#F8FAFC' : '#0F172A';
  const textSub = isDarkMode ? '#94A3B8' : '#64748B';
  const inputBg = isDarkMode ? '#0B1120' : '#F8FAFC';
  const inputBorder = isDarkMode ? '#1E293B' : '#E2E8F0';

  const isWa = currentMethod === 'WHATSAPP';
  const isComplete = code.every(d => d.length === 1);
  const maskedPhone = phone ? `+91 ${phone.substring(0, 4)}••••${phone.substring(8)}` : '+91 ••••••••••';

  return (
    <View style={[styles.root, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8F9FD' }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Ambient Gradient Canvas */}
      <LinearGradient
        colors={
          isDarkMode
            ? ['#0B0F19', '#111827', '#0B0F19']
            : ['#FFFFFF', '#F6F8FC', '#EEF2FF', '#FFFFFF']
        }
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient Glowing Orbs */}
      <View pointerEvents="none" style={styles.bgOrbTopLeft}>
        <LinearGradient colors={['#8B5CF6', '#6C47FF']} style={StyleSheet.absoluteFill} />
      </View>
      <View pointerEvents="none" style={styles.bgOrbBottomRight}>
        <LinearGradient colors={['#3B82F6', '#6C47FF']} style={StyleSheet.absoluteFill} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: safeTopPadding,
              paddingBottom: keyboardVisible ? (keyboardHeight || bottomInset) : (safeBottomInset + (isSmallScreen ? 8 : 12)),
              justifyContent: keyboardVisible ? 'flex-start' : 'space-between',
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          scrollEnabled={keyboardVisible}
        >
          <View style={[styles.topSection, topSectionDynamicStyle]}>
            {/* Top Brand Header */}
            <View style={[styles.headerBlock, isSmallScreen && { marginBottom: 6 }, isTallScreen && { marginBottom: 16 }]}>
            <View style={styles.logoRow}>
              <KwicklyIcon size={38} />
              <Text style={[styles.wordmark, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                Kwick<Text style={{ color: '#6C47FF' }}>ly</Text>
              </Text>
            </View>

            <View style={[styles.pillBadge, { backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#FFFFFF', borderColor: isDarkMode ? 'rgba(108, 71, 255, 0.3)' : '#E2E8F0' }]}>
              {isWa ? <Smartphone size={12} color="#10B981" /> : <MessageSquare size={12} color="#6C47FF" />}
              <Text style={[styles.pillText, { color: isWa ? '#10B981' : (isDarkMode ? '#C4B5FD' : '#475569') }]}>
                {isWa ? 'WhatsApp Verification' : 'SMS Verification'}
              </Text>
            </View>

            <Text style={[styles.title, { color: textMain }]}>
              Verify Your <Text style={{ color: '#6C47FF' }}>Number</Text>
            </Text>

            {/* Masked Phone Pill with Edit Button */}
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.phonePill, { backgroundColor: isDarkMode ? '#1E2540' : '#F0F2FF', borderColor: isDarkMode ? '#2D3760' : '#E0E4FF' }]}
              activeOpacity={0.75}
            >
              <Text style={[styles.phonePillText, { color: PURPLE }]}>{maskedPhone}</Text>
              <Edit3 size={13} color={PURPLE} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>

          {/* Floating Form Card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }, cardDynamicStyle]}>
            <Text style={[styles.cardHeading, { color: textMain }]}>
              Enter Verification Code
            </Text>
            <Text style={[styles.cardSubheading, { color: textSub }]}>
              Type the 4-digit code. It auto-verifies when complete.
            </Text>

            {/* 4-Box PIN Layout */}
            <View style={styles.codeContainer}>
              {[0, 1, 2, 3].map((index) => {
                const isFocused = focusedIndex === index;
                const isFilled = !!code[index];
                return (
                  <TextInput
                    key={index}
                    ref={(ref) => (inputs.current[index] = ref)}
                    style={[
                      styles.codeBox,
                      {
                        backgroundColor: inputBg,
                        borderColor: isFocused ? PURPLE : isFilled ? PURPLE : inputBorder,
                        color: textMain,
                      },
                      isFocused && styles.codeBoxActiveGlow,
                    ]}
                    keyboardType="number-pad"
                    maxLength={index === 0 ? 4 : 1}
                    value={code[index]}
                    onChangeText={(text) => handleChange(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    onFocus={() => {
                      setFocusedIndex(index);
                      setTimeout(() => scrollRef.current?.scrollTo({ y: 70, animated: true }), 100);
                    }}
                    onBlur={() => setFocusedIndex(null)}
                    selectTextOnFocus
                    caretHidden
                  />
                );
              })}
            </View>

            {/* Auto-verification status indicator */}
            <View style={[styles.statusBadge, { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5', borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.25)' : '#A7F3D0' }]}>
              <ShieldCheck size={14} color="#10B981" />
              <Text style={[styles.statusText, { color: '#059669' }]}>
                Auto-verifying your single-use OTP securely
              </Text>
            </View>

            {/* Verify & Continue Button */}
            <TouchableOpacity
              onPress={() => handleVerify()}
              disabled={!isComplete || loading}
              activeOpacity={0.88}
              style={[styles.btnShadow, { opacity: isComplete && !loading ? 1 : 0.45, marginTop: 16 }]}
            >
              <LinearGradient
                colors={[PURPLE, '#582BE8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaBtn}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.ctaText}>Verify & Continue</Text>
                    <ArrowRight size={17} color="#FFF" style={{ marginLeft: 6 }} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Resend & Alternative Method Row */}
            <View style={styles.resendSection}>
              {countdown > 0 ? (
                <View style={styles.countdownRow}>
                  <RefreshCw size={13} color={textSub} />
                  <Text style={[styles.countdownText, { color: textSub }]}>
                    {' '}Resend in <Text style={{ color: PURPLE, fontWeight: '700' }}>{countdown}s</Text>
                  </Text>
                </View>
              ) : (
                <TouchableOpacity onPress={handleResend} style={styles.resendBtn} activeOpacity={0.75}>
                  <RefreshCw size={14} color={PURPLE} />
                  <Text style={[styles.resendBtnText, { color: PURPLE }]}> Resend Code</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={toggleMethod} style={styles.switchMethodBtn} activeOpacity={0.75}>
                <Text style={[styles.switchMethodText, { color: textSub }]}>
                  Didn't receive code?{' '}
                  <Text style={{ color: PURPLE, fontWeight: '700' }}>
                    {isWa ? 'Send via SMS' : 'Send via WhatsApp'}
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <View style={styles.trustFooter}>
            <ShieldCheck size={14} color="#10B981" />
            <Text style={[styles.trustText, { color: textSub }]}>
              Bank-grade 256-bit encryption · 100% Secure
            </Text>
          </View>
          {isTallScreen && (
            <View style={styles.supportRow}>
              <MessageSquare size={13} color={PURPLE} />
              <Text style={[styles.supportText, { color: textSub }]}>
                Need help? <Text style={{ color: PURPLE, fontWeight: '700' }}>Kwickly Support is available 24/7</Text>
              </Text>
            </View>
          )}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={() => setAlertConfig(p => ({ ...p, visible: false }))}
        onRequestClose={() => setAlertConfig(p => ({ ...p, visible: false }))}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  bgOrbTopLeft: {
    position: 'absolute',
    top: -50,
    left: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.14,
    overflow: 'hidden',
  },
  bgOrbBottomRight: {
    position: 'absolute',
    bottom: 80,
    right: -70,
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.12,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: 16,
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  wordmark: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 10,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  phonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
  },
  phonePillText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 22,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  cardHeading: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  cardSubheading: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  codeBox: {
    width: 56,
    height: 60,
    borderRadius: 16,
    borderWidth: 2,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  codeBoxActiveGlow: {
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    marginVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  btnShadow: {
    width: '100%',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 5,
  },
  ctaBtn: {
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  resendSection: {
    alignItems: 'center',
    marginTop: 18,
    gap: 10,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 13,
    fontWeight: '500',
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resendBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  switchMethodBtn: {
    paddingVertical: 4,
  },
  switchMethodText: {
    fontSize: 12.5,
  },
  topSection: {
    width: '100%',
  },
  bottomSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    marginBottom: 2,
  },
  trustFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  trustText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  supportText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
});

export default OTPVerifyScreen;
