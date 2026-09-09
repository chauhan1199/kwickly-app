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
  Pressable,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { MessageSquare, Smartphone, ShieldCheck, Edit3, RefreshCw } from 'lucide-react-native';
import CustomAlert from '../../components/ui/CustomAlert';
import api, { getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { validateOtpForSubmit, sanitizeOtp } from '../../utils/otpGuard';

// ── Design tokens (matches HomeScreen) ──
const PURPLE = '#6C47FF';
const PURPLE_LIGHT = '#EEE8FF';
const RESEND_COOLDOWN = 30;

const OTPVerifyScreen = ({ navigation, route }) => {
  const { phone, role, otpMethod = 'SMS', fullName } = route.params || {};
  const [currentMethod, setCurrentMethod] = useState(otpMethod);
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [code, setCode] = useState(['', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' });

  const inputs = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    // Auto-focus first box
    const t = setTimeout(() => { if (inputs.current[0]) inputs.current[0].focus(); }, 300);
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
    // Handle paste (>1 char)
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

  const topPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
  const bottomPad = Math.max(insets.bottom, 16);

  const cardBg = isDarkMode ? '#13172A' : '#FFFFFF';
  const border = isDarkMode ? '#2A3050' : '#E8EAFF';
  const textMain = isDarkMode ? '#F1F2FF' : '#1A1A2E';
  const textSub = isDarkMode ? '#7B83B0' : '#64748B';
  const inputBg = isDarkMode ? '#0A0D1C' : '#F8F9FF';

  const isWa = currentMethod === 'WHATSAPP';
  const accentColor = isWa ? '#10B981' : PURPLE;
  const MethodIcon = isWa ? Smartphone : MessageSquare;
  const isComplete = code.every(d => d.length === 1);
  const maskedPhone = phone ? `${phone.substring(0, 4)}••••${phone.substring(8)}` : '••••••••••';

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: isDarkMode ? '#0C0E1A' : '#FFF' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── HERO (matches HomeScreen purple gradient) ── */}
      <LinearGradient
        colors={isWa ? ['#059669', '#10B981'] : [PURPLE, '#8B6FFF']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: topPad + 24 }]}
      >
        <View style={styles.blob1} /><View style={styles.blob2} />

        {/* Brand */}
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={styles.brandName}>Kwick<Text style={{ color: '#FFD580' }}>ly</Text></Text>
        </View>

        {/* Method icon badge */}
        <View style={styles.iconBadge}>
          <MethodIcon size={28} color="#FFF" />
        </View>

        <Text style={styles.heroTitle}>
          {isWa ? 'Check WhatsApp' : 'Check your SMS'}
        </Text>

        {/* Phone pill with edit */}
        <TouchableOpacity style={styles.phonePill} onPress={() => navigation.goBack()}>
          <Text style={styles.phonePillText}>+91 {maskedPhone}</Text>
          <Edit3 size={11} color="rgba(255,255,255,0.75)" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </LinearGradient>

      {/* ── FORM CARD ── */}
      <View style={[styles.card, { backgroundColor: cardBg, paddingBottom: bottomPad + 12 }]}>
        <Text style={[styles.cardHeading, { color: textMain }]}>Enter Verification Code</Text>
        <Text style={[styles.cardSub, { color: textSub }]}>
          Type the 4-digit code. It auto-verifies when complete.
        </Text>

        {/* OTP Boxes */}
        <View style={styles.otpRow}>
          {code.map((digit, index) => {
            const isFocused = focusedIndex === index;
            const isFilled = digit.length > 0;
            return (
              <Pressable
                key={index}
                onPress={() => { inputs.current[index]?.focus(); setFocusedIndex(index); }}
                style={[
                  styles.otpBox,
                  { backgroundColor: inputBg, borderColor: border },
                  isFocused && { borderColor: accentColor, backgroundColor: isDarkMode ? `${accentColor}20` : (isWa ? '#ECFDF5' : PURPLE_LIGHT), borderWidth: 2 },
                  isFilled && !isFocused && { borderColor: accentColor },
                ]}
              >
                <TextInput
                  ref={ref => { inputs.current[index] = ref; }}
                  style={[styles.otpInput, { color: textMain }]}
                  maxLength={4}
                  keyboardType="number-pad"
                  autoFocus={false}
                  selectTextOnFocus
                  value={digit}
                  onChangeText={t => handleChange(t, index)}
                  onKeyPress={e => handleKeyPress(e, index)}
                  onFocus={() => setFocusedIndex(index)}
                  onBlur={() => setFocusedIndex(null)}
                  caretHidden
                />
              </Pressable>
            );
          })}
        </View>

        {/* Security notice */}
        <View style={[styles.secNotice, { backgroundColor: isDarkMode ? 'rgba(16,185,129,0.12)' : '#ECFDF5' }]}>
          <ShieldCheck size={13} color="#10B981" style={{ marginRight: 6 }} />
          <Text style={styles.secNoticeText}>Auto-verifying your single-use OTP securely</Text>
        </View>

        {/* Verify button */}
        <TouchableOpacity
          style={{ opacity: (isComplete && !loading) ? 1 : 0.5 }}
          onPress={() => handleVerify()}
          disabled={!isComplete || loading || sending}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={isWa ? ['#059669', '#10B981'] : [PURPLE, '#8B6FFF']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.ctaBtn}
          >
            {loading ? <ActivityIndicator size="small" color="#FFF" /> : (
              <Text style={styles.ctaText}>Verify & Continue →</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Resend & switch */}
        <View style={styles.resendArea}>
          {countdown > 0 ? (
            <View style={styles.resendRow}>
              <RefreshCw size={12} color={textSub} style={{ marginRight: 5 }} />
              <Text style={[styles.resendText, { color: textSub }]}>
                Resend in{' '}
                <Text style={[styles.resendText, { color: accentColor, fontWeight: '800' }]}>
                  {countdown}s
                </Text>
              </Text>
            </View>
          ) : (
            <View style={styles.resendRow}>
              <Text style={[styles.resendText, { color: textSub }]}>Didn't get it? </Text>
              <TouchableOpacity onPress={handleResend} disabled={sending || loading}>
                <Text style={[styles.resendText, { color: accentColor, fontWeight: '800' }]}>
                  {sending ? 'Sending…' : 'Resend'}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.resendText, { color: textSub }]}> · </Text>
              <TouchableOpacity onPress={toggleMethod} disabled={sending || loading}>
                <Text style={[styles.resendText, { color: textMain, fontWeight: '800' }]}>
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

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Hero
  hero: { paddingHorizontal: 20, paddingBottom: 26, overflow: 'hidden' },
  blob1: {
    position: 'absolute', top: -50, right: -50,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  blob2: {
    position: 'absolute', bottom: -30, left: -40,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  brandDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#FFD580', marginRight: 8 },
  brandName: { fontSize: 20, fontWeight: '900', color: '#FFF', letterSpacing: -0.3 },
  iconBadge: {
    width: 58, height: 58, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#FFF', letterSpacing: -0.4, marginBottom: 10 },
  phonePill: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  phonePillText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  // Card
  card: {
    flex: 1, paddingHorizontal: 20, paddingTop: 22,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 5,
  },
  cardHeading: { fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  cardSub: { fontSize: 13, marginTop: 3, marginBottom: 22 },

  // OTP Boxes
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 16 },
  otpBox: {
    width: 64, height: 68, borderRadius: 16, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  otpInput: {
    width: '100%', height: '100%',
    textAlign: 'center', fontSize: 26, fontWeight: '900', padding: 0,
  },

  // Security notice
  secNotice: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginBottom: 18,
  },
  secNoticeText: { fontSize: 12, fontWeight: '600', color: '#10B981' },

  // CTA
  ctaBtn: {
    height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  ctaText: { color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 },

  // Resend
  resendArea: { alignItems: 'center', marginTop: 16 },
  resendRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  resendText: { fontSize: 13, fontWeight: '500' },
});

export default OTPVerifyScreen;
