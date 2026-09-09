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
} from 'lucide-react-native';
import CustomAlert from '../../components/ui/CustomAlert';
import api, { getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { validateOtpForSubmit, sanitizeOtp } from '../../utils/otpGuard';

const { width: SW, height: SH } = Dimensions.get('window');

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
      const pastedCode = digitOnly.slice(0, 4).split('');
      const newCode = [...code];
      pastedCode.forEach((char, i) => { if (index + i < 4) newCode[index + i] = char; });
      setCode(newCode);
      const nextIndex = Math.min(index + pastedCode.length, 3);
      if (inputs.current[nextIndex]) inputs.current[nextIndex].focus();
      if (newCode.every((d) => d.length === 1)) handleVerify(newCode.join(''));
      return;
    }
    const newCode = [...code];
    newCode[index] = digitOnly;
    setCode(newCode);
    if (text && index < 3 && inputs.current[index + 1]) {
      inputs.current[index + 1].focus();
      setFocusedIndex(index + 1);
    }
    if (digitOnly && index === 3 && newCode.every((d) => d.length === 1)) handleVerify(newCode.join(''));
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
    if (!validation.valid) { showAlert('Invalid Code', validation.message); return; }
    const otpCode = validation.code;
    setLoading(true);
    try {
      const response = await api.post('/auth/verify-otp', { phone, code: otpCode, role, name: fullName });
      const { token, isNew, user } = response.data.data;
      if (isNew) {
        navigation.navigate('SetMpin', { phone, role, token, user, name: fullName || user?.name || 'User' });
      } else {
        await signIn(token, user?.role || role, user);
      }
    } catch (error) {
      showAlert('Verification Failed', getApiErrorMessage(error, 'Invalid verification code'), 'error');
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
      showAlert('Error', getApiErrorMessage(error, 'Failed to send OTP'));
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => { if (countdown > 0) return; await sendOtp(currentMethod); };
  const toggleMethod = async () => {
    const next = currentMethod === 'SMS' ? 'WHATSAPP' : 'SMS';
    setCurrentMethod(next);
    await sendOtp(next);
  };

  const topPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
  const bottomPad = Math.max(insets.bottom, 16);
  const displayPhone = phone ? `${phone.substring(0, 4)}••••${phone.substring(8)}` : '••••••••••';
  const isComplete = code.every((d) => d.length === 1);

  const bg = isDarkMode ? '#0C0E1A' : '#F0F2FF';
  const cardBg = isDarkMode ? '#13172A' : '#FFFFFF';
  const border = isDarkMode ? '#1E2540' : '#E4E8FF';
  const textMain = isDarkMode ? '#F1F2FF' : '#111827';
  const textSub = isDarkMode ? '#7B83B0' : '#6B7280';
  const inputBg = isDarkMode ? '#0A0D1C' : '#F8F9FF';

  const isWa = currentMethod === 'WHATSAPP';
  const methodColor = isWa ? '#10B981' : '#7C47FF';
  const MethodIcon = isWa ? Smartphone : MessageSquare;

  return (
    <KeyboardAvoidingView style={[s.root, { backgroundColor: bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Hero */}
      <LinearGradient
        colors={isWa ? ['#0A7A54', '#10B981', '#34D399'] : ['#5B2FD4', '#7C47FF', '#9B6BFF']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.hero, { paddingTop: topPad + 24 }]}
      >
        {/* Icon badge */}
        <View style={s.iconBadge}>
          <MethodIcon size={30} color="#FFF" />
        </View>
        <Text style={s.heroTitle}>
          Check your {isWa ? 'WhatsApp' : 'Messages'}
        </Text>
        <View style={s.phonePillRow}>
          <Text style={s.heroSub}>Code sent to </Text>
          <View style={s.phonePill}>
            <Text style={s.phonePillText}>+91 {displayPhone}</Text>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 4 }}>
              <Edit3 size={11} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Card body */}
      <View style={[s.formArea, { backgroundColor: cardBg, paddingBottom: bottomPad + 16 }]}>
        {/* Instructions */}
        <Text style={[s.sectionTitle, { color: textMain }]}>Enter Verification Code</Text>
        <Text style={[s.sectionSub, { color: textSub, marginBottom: 22 }]}>
          Type the 4-digit code below. It auto-verifies once complete.
        </Text>

        {/* OTP Boxes */}
        <View style={s.otpRow}>
          {code.map((digit, index) => {
            const isFocused = focusedIndex === index;
            const isFilled = digit.length > 0;
            return (
              <View
                key={index}
                style={[
                  s.otpBox,
                  { backgroundColor: inputBg, borderColor: border },
                  isFocused && { borderColor: methodColor, backgroundColor: isDarkMode ? `${methodColor}20` : '#F0EEFF', borderWidth: 2 },
                  isFilled && { borderColor: methodColor, backgroundColor: isDarkMode ? `${methodColor}20` : '#F0EEFF' },
                ]}
              >
                <TextInput
                  ref={(ref) => (inputs.current[index] = ref)}
                  style={[s.otpInput, { color: textMain }]}
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

        {/* Security notice */}
        <View style={[s.noticeRow, { backgroundColor: isDarkMode ? 'rgba(16,185,129,0.1)' : '#ECFDF5' }]}>
          <ShieldCheck size={14} color="#10B981" style={{ marginRight: 6 }} />
          <Text style={s.noticeText}>Auto-verifying your secure single-use OTP</Text>
        </View>

        {/* Verify button */}
        <TouchableOpacity
          style={{ opacity: (isComplete && !loading) ? 1 : 0.55 }}
          onPress={() => handleVerify()}
          disabled={!isComplete || loading || sending}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={isWa ? ['#059669', '#10B981'] : ['#6334E8', '#7C47FF']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.ctaGrad}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={s.ctaText}>Verify & Continue →</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Resend & switch */}
        <View style={s.resendContainer}>
          {countdown > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <RefreshCw size={13} color={textSub} style={{ marginRight: 6 }} />
              <Text style={[s.resendText, { color: textSub }]}>
                Resend in <Text style={[s.resendText, { color: methodColor, fontWeight: '800' }]}>{countdown}s</Text>
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
              <Text style={[s.resendText, { color: textSub }]}>Didn't receive it? </Text>
              <TouchableOpacity onPress={handleResend} disabled={sending || loading}>
                <Text style={[s.resendText, { color: methodColor, fontWeight: '800' }]}>
                  {sending ? 'Sending...' : 'Resend OTP'}
                </Text>
              </TouchableOpacity>
              <Text style={[s.resendText, { color: textSub }]}> · </Text>
              <TouchableOpacity onPress={toggleMethod} disabled={sending || loading}>
                <Text style={[s.resendText, { color: textMain, fontWeight: '800' }]}>
                  Try {isWa ? 'SMS' : 'WhatsApp'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={() => setAlertConfig(p => ({ ...p, visible: false }))}
      />
    </KeyboardAvoidingView>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },
  hero: { paddingHorizontal: 20, paddingBottom: 28 },
  iconBadge: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#FFF', letterSpacing: -0.4, marginBottom: 6 },
  phonePillRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  phonePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  phonePillText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  formArea: {
    flex: 1, paddingHorizontal: 20, paddingTop: 22,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -10,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 13, marginTop: 3 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 16 },
  otpBox: {
    width: 62, height: 64, borderRadius: 16, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  otpInput: { width: '100%', height: '100%', textAlign: 'center', fontSize: 26, fontWeight: '900', padding: 0 },
  noticeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, marginBottom: 18 },
  noticeText: { fontSize: 12, fontWeight: '600', color: '#10B981' },
  ctaGrad: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#7C47FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  ctaText: { color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 },
  resendContainer: { alignItems: 'center', marginTop: 16 },
  resendText: { fontSize: 13, fontWeight: '500' },
});

export default OTPVerifyScreen;
