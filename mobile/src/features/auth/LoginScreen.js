import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Keyboard,
  Animated,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';
import {
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  MessageSquare,
  User,
  Store,
  Wrench,
  Edit3,
  AlertCircle,
  CheckCircle2,
  Zap,
  X,
} from 'lucide-react-native';
import { authService } from '../../services/authService';
import { getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import CustomAlert from '../../components/ui/CustomAlert';
import LinearGradient from 'react-native-linear-gradient';

const { width: SW } = Dimensions.get('window');

// ── Design tokens (matches HomeScreen) ──
const PURPLE = '#6C47FF';
const PURPLE_LIGHT = '#EEE8FF';

const ROLE_META = {
  CUSTOMER: { label: 'Customer', icon: User, color: PURPLE, bg: PURPLE_LIGHT },
  WORKER: { label: 'Worker / Pro', icon: Wrench, color: '#10B981', bg: '#D1FAE5' },
  SHOP: { label: 'Shop Owner', icon: Store, color: '#F59E0B', bg: '#FEF3C7' },
};

const LoginScreen = ({ navigation, route }) => {
  const { role: initialRole = null, prefillPhone = '' } = route.params || {};
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [step, setStep] = useState('PHONE');
  const [phone, setPhone] = useState(prefillPhone);
  const [selectedRole, setSelectedRole] = useState(initialRole || 'CUSTOMER');
  const [detectedName, setDetectedName] = useState('');
  const [availableAccounts, setAvailableAccounts] = useState([]);

  const [mpin, setMpin] = useState('');
  const [showMpin, setShowMpin] = useState(false);
  const [mpinError, setMpinError] = useState('');

  const [resetOtp, setResetOtp] = useState('');
  const [newMpin, setNewMpin] = useState('');
  const [confirmNewMpin, setConfirmNewMpin] = useState('');
  const [showNewMpin, setShowNewMpin] = useState(false);

  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const phoneInputRef = useRef(null);
  const mpinInputRef = useRef(null);
  const isCheckingRef = useRef(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (prefillPhone && prefillPhone.length === 10) handleCheckNumber(prefillPhone);
  }, []); // eslint-disable-line

  useEffect(() => {
    if (step === 'MPIN') {
      setMpin(''); setMpinError('');
      const t = setTimeout(() => mpinInputRef.current?.focus(), 280);
      return () => clearTimeout(t);
    }
  }, [step]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start();
  };

  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error', onConfirm: null });
  const showAlert = (title, message, type = 'error', onConfirm = null) => {
    setAlertConfig({ visible: true, title, message, type, onConfirm });
  };
  const dismissAlert = () => {
    const cb = alertConfig.onConfirm;
    setAlertConfig(p => ({ ...p, visible: false, onConfirm: null }));
    if (cb) cb();
  };

  // ── Step 1: Check phone number ──
  const handleCheckNumber = async (numberToCheck) => {
    const targetPhone = (numberToCheck || phone || '').replace(/\D/g, '');
    if (!targetPhone || targetPhone.length !== 10) {
      showAlert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setLoading(true);
    try {
      const response = await authService.checkStatus(targetPhone);
      const data = response?.data?.data || response?.data || {};

      if (!data.exists) {
        showAlert(
          'Account Not Found',
          `No account found for +91 ${targetPhone}. Would you like to create one?`,
          'info',
          () => navigation.navigate('RoleSelection', { prefillPhone: targetPhone })
        );
        return;
      }

      const accounts = Array.isArray(data.accounts) && data.accounts.length > 0
        ? data.accounts
        : [{ role: data.role || 'CUSTOMER', name: data.name || 'User', hasMpin: data.hasMpin ?? true }];

      setAvailableAccounts(accounts);

      if (accounts.length > 1) {
        setStep('SELECT_ROLE');
      } else {
        const acc = accounts[0];
        setSelectedRole(acc.role);
        setDetectedName(acc.name);
        if (acc.hasMpin) {
          setStep('MPIN');
        } else {
          handleAutoSendOtp(targetPhone, acc.role);
        }
      }
    } catch (error) {
      showAlert('Sign In Failed', getApiErrorMessage(error, 'Could not verify your number. Please try again.'));
    } finally {
      setLoading(false);
      isCheckingRef.current = false;
    }
  };

  const handlePhoneChange = (text) => {
    let digits = (text || '').replace(/\D/g, '');
    if (digits.length > 10 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (digits.length > 10 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    const clean = digits.slice(0, 10);
    setPhone(clean);
    if (mpinError) setMpinError('');
    if (clean.length === 10) { Keyboard.dismiss(); handleCheckNumber(clean); }
  };

  const handleAutoSendOtp = (targetPhone, role) => {
    showAlert(
      'MPIN Not Set',
      'We\'ll send you an OTP to sign in and set your 4-digit MPIN.',
      'info',
      async () => {
        setLoading(true);
        try {
          await authService.sendOtp(targetPhone, role);
          navigation.navigate('OTPVerify', { phone: targetPhone, role });
        } catch (err) {
          showAlert('Error', getApiErrorMessage(err, 'Failed to send OTP. Please try again.'));
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // ── Step 2: Select account (multi-role) ──
  const handleSelectAccount = (acc) => {
    setSelectedRole(acc.role);
    setDetectedName(acc.name);
    if (acc.hasMpin) { setStep('MPIN'); } else { handleAutoSendOtp(phone, acc.role); }
  };

  // ── Step 3: MPIN login ──
  const handleMpinChange = (text) => {
    const clean = text.replace(/\D/g, '').slice(0, 4);
    setMpin(clean);
    if (mpinError) setMpinError('');
    if (clean.length === 4) handleMpinSubmit(clean);
  };

  const handleMpinSubmit = async (pinValue) => {
    const pin = (typeof pinValue === 'string' && pinValue.length === 4) ? pinValue : mpin;
    if (!pin || pin.length !== 4) {
      setMpinError('Please enter a valid 4-digit MPIN');
      triggerShake();
      return;
    }
    setLoading(true);
    setMpinError('');
    try {
      const response = await authService.login(phone, pin, selectedRole);
      const resData = response?.data?.data || response?.data || {};
      const token = resData.token;
      const user = resData.user || {};
      const activeRole = user.role || selectedRole || 'CUSTOMER';
      if (!token) throw new Error('No authentication token received');
      await signIn(token, activeRole, user);
    } catch (error) {
      triggerShake();
      const status = error?.response?.status;
      const data = error?.response?.data || {};
      if (status === 400 || status === 401) {
        const remaining = data.remainingAttempts;
        const msg = remaining !== undefined
          ? `Incorrect MPIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Incorrect MPIN. Please try again.';
        setMpinError(msg);
        setMpin('');
        setTimeout(() => mpinInputRef.current?.focus(), 150);
      } else if (status === 429) {
        setMpinError('Too many failed attempts. Please reset your MPIN.');
      } else {
        showAlert('Sign In Failed', getApiErrorMessage(error, 'Sign in failed. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 4: Forgot MPIN ──
  const handleForgotMpin = async () => {
    setLoading(true);
    try {
      await authService.forgotMpin(phone, selectedRole);
      setResetOtp('');
      setNewMpin('');
      setConfirmNewMpin('');
      setStep('RESET_MPIN');
    } catch (error) {
      showAlert('Error', getApiErrorMessage(error, 'Failed to send OTP. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetMpin = async () => {
    if (!resetOtp || resetOtp.length !== 4) {
      showAlert('Invalid OTP', 'Please enter the 4-digit OTP sent to your phone.');
      return;
    }
    if (!newMpin || newMpin.length !== 4) {
      showAlert('Invalid MPIN', 'New MPIN must be 4 digits.');
      return;
    }
    if (newMpin !== confirmNewMpin) {
      showAlert('Mismatch', 'MPINs do not match. Please re-enter.');
      return;
    }
    setLoading(true);
    try {
      await authService.resetMpin(phone, resetOtp, newMpin, selectedRole);
      showAlert(
        'MPIN Reset!',
        'Your MPIN has been updated. Signing you in...',
        'success',
        async () => {
          try {
            const loginRes = await authService.login(phone, newMpin, selectedRole);
            const resData = loginRes?.data?.data || loginRes?.data || {};
            await signIn(resData.token, selectedRole, resData.user || {});
          } catch {
            setStep('MPIN');
          }
        }
      );
    } catch (error) {
      showAlert('Reset Failed', getApiErrorMessage(error, 'Failed to reset MPIN. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleDirectOtpLogin = async () => {
    setLoading(true);
    try {
      await authService.sendOtp(phone, selectedRole);
      navigation.navigate('OTPVerify', { phone, role: selectedRole });
    } catch (err) {
      showAlert('Error', getApiErrorMessage(err, 'Failed to send OTP.'));
    } finally {
      setLoading(false);
    }
  };

  const topPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
  const bottomPad = Math.max(insets.bottom, 16);

  const cardBg = isDarkMode ? '#13172A' : '#FFFFFF';
  const border = isDarkMode ? '#2A3050' : '#E8EAFF';
  const textMain = isDarkMode ? '#F1F2FF' : '#1A1A2E';
  const textSub = isDarkMode ? '#7B83B0' : '#64748B';
  const inputBg = isDarkMode ? '#0A0D1C' : '#F8F9FF';

  const currentRoleMeta = ROLE_META[selectedRole] || ROLE_META.CUSTOMER;
  const RoleIcon = currentRoleMeta.icon;

  const isResetMatched = newMpin.length === 4 && confirmNewMpin.length === 4 && newMpin === confirmNewMpin;
  const isResetMismatched = confirmNewMpin.length === 4 && newMpin.length === 4 && newMpin !== confirmNewMpin;

  // ── Shared Hero with official KwicklyIcon (matches HomeScreen) ──
  const Hero = ({ title, subtitle, children }) => (
    <LinearGradient
      colors={[PURPLE, '#8B6FFF']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[styles.hero, { paddingTop: topPad + 18 }]}
    >
      <View style={styles.blob1} /><View style={styles.blob2} />
      <View style={styles.brandRow}>
        <KwicklyIcon size={38} />
        <Text style={styles.brandName}>Kwick<Text style={{ color: '#FFD580' }}>ly</Text></Text>
      </View>
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroSub}>{subtitle}</Text>
      {children}
    </LinearGradient>
  );

  const alertEl = (
    <CustomAlert
      visible={alertConfig.visible}
      title={alertConfig.title}
      message={alertConfig.message}
      type={alertConfig.type}
      onConfirm={dismissAlert}
    />
  );

  // ══════════════════════════════════════════
  // STEP: PHONE
  // ══════════════════════════════════════════
  if (step === 'PHONE') {
    return (
      <View style={[styles.root, { backgroundColor: isDarkMode ? '#0C0E1A' : '#FFF' }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
            <Hero title="Welcome Back!" subtitle="Sign in to continue your journey">
              <View style={styles.trustPill}>
                <Zap size={12} color="#FFD580" />
                <Text style={styles.trustPillText}>Auto-detects your account · Secure</Text>
              </View>
            </Hero>

            <View style={[styles.card, { backgroundColor: cardBg, paddingBottom: bottomPad + 16 }]}>
              <Text style={[styles.cardHeading, { color: textMain }]}>Enter Mobile Number</Text>
              <Text style={[styles.cardSub, { color: textSub }]}>We'll find your account automatically</Text>

              <TouchableOpacity
                activeOpacity={1}
                onPress={() => phoneInputRef.current?.focus()}
                style={[
                  styles.inputWrap,
                  { backgroundColor: inputBg, borderColor: phone.length === 10 ? '#10B981' : focusedInput === 'phone' ? PURPLE : border, marginTop: 18 },
                  focusedInput === 'phone' && styles.inputFocusShadow,
                ]}
              >
                <View pointerEvents="none" style={styles.prefixBox}>
                  <Text style={[styles.prefix, { color: textMain, borderRightColor: border }]}>🇮🇳 +91</Text>
                </View>
                <TextInput
                  ref={phoneInputRef}
                  style={[styles.inputText, { color: textMain }]}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={textSub}
                  keyboardType="phone-pad"
                  maxLength={15}
                  editable={!loading}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  onFocus={() => setFocusedInput('phone')}
                  onBlur={() => setFocusedInput(null)}
                  returnKeyType="done"
                  onSubmitEditing={() => { if (phone.length === 10) handleCheckNumber(phone); }}
                />
                {phone.length === 10 ? (
                  <CheckCircle2 size={18} color="#10B981" />
                ) : phone.length > 0 ? (
                  <TouchableOpacity onPress={() => setPhone('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <X size={16} color={textSub} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>

              <TouchableOpacity
                style={{ opacity: (phone.length === 10 && !loading) ? 1 : 0.5, marginTop: 20 }}
                onPress={() => handleCheckNumber()}
                disabled={phone.length !== 10 || loading}
                activeOpacity={0.88}
              >
                <LinearGradient colors={[PURPLE, '#8B6FFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtn}>
                  {loading ? <ActivityIndicator size="small" color="#FFF" /> : (
                    <><Text style={styles.ctaText}>Continue</Text><ArrowRight size={18} color="#FFF" style={{ marginLeft: 8 }} /></>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={{ alignItems: 'center', marginTop: 16 }} onPress={() => navigation.navigate('RoleSelection', { prefillPhone: phone })}>
                <Text style={[styles.footerText, { color: textSub }]}>
                  New to Kwickly? <Text style={styles.footerLink}>Create Account</Text>
                </Text>
              </TouchableOpacity>

              {!keyboardVisible && (
                <View style={[styles.trustRow, { marginTop: 18 }]}>
                  <ShieldCheck size={13} color="#10B981" />
                  <Text style={[styles.trustText, { color: textSub }]}> 100% Encrypted · </Text>
                  <Zap size={12} color={PURPLE} />
                  <Text style={[styles.trustText, { color: textSub }]}> Instant MPIN · 🇮🇳 India</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        {alertEl}
      </View>
    );
  }

  // ══════════════════════════════════════════
  // STEP: SELECT_ROLE
  // ══════════════════════════════════════════
  if (step === 'SELECT_ROLE') {
    return (
      <View style={[styles.root, { backgroundColor: isDarkMode ? '#0C0E1A' : '#FFF' }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
            <Hero title="Select Profile" subtitle={`Multiple accounts found for +91 ${phone}`} />
            <View style={[styles.card, { backgroundColor: cardBg, paddingBottom: bottomPad + 16 }]}>
              {availableAccounts.map((acc, idx) => {
                const meta = ROLE_META[acc.role] || ROLE_META.CUSTOMER;
                const Icon = meta.icon;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.accountCard, { backgroundColor: inputBg, borderColor: border }]}
                    onPress={() => handleSelectAccount(acc)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.accountIconWrap, { backgroundColor: meta.bg }]}>
                      <Icon size={22} color={meta.color} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.accountRole, { color: textMain }]}>{meta.label}</Text>
                      <Text style={[styles.accountName, { color: textSub }]}>{acc.name || 'Registered Profile'}</Text>
                    </View>
                    <ArrowRight size={16} color={textSub} />
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={{ alignItems: 'center', marginTop: 18 }} onPress={() => setStep('PHONE')}>
                <Text style={styles.footerLink}>Use a different number</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        {alertEl}
      </View>
    );
  }

  // ══════════════════════════════════════════
  // STEP: MPIN
  // ══════════════════════════════════════════
  if (step === 'MPIN') {
    return (
      <View style={[styles.root, { backgroundColor: isDarkMode ? '#0C0E1A' : '#FFF' }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
            <Hero title={`Welcome Back${detectedName ? `, ${detectedName}` : ''}!`} subtitle="Enter your 4-digit MPIN">
              <TouchableOpacity style={styles.rolePill} onPress={() => setStep('PHONE')}>
                <RoleIcon size={12} color="#FFF" />
                <Text style={styles.rolePillText}>{currentRoleMeta.label}</Text>
                <Text style={styles.rolePillSep}> · </Text>
                <Text style={styles.rolePillText}>+91 {phone}</Text>
                <Edit3 size={11} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </Hero>

            <View style={[styles.card, { backgroundColor: cardBg, paddingBottom: bottomPad + 12 }]}>
              {/* Hidden real input */}
              <TextInput
                ref={mpinInputRef}
                style={styles.hiddenInput}
                keyboardType="phone-pad"
                maxLength={4}
                value={mpin}
                onChangeText={handleMpinChange}
                onFocus={() => setFocusedInput('mpin')}
                onBlur={() => setFocusedInput(null)}
                caretHidden
              />

              <Text style={[styles.cardSub, { color: textSub, textAlign: 'center', marginBottom: 20 }]}>
                Tap to enter your secure PIN
              </Text>

              {/* PIN Boxes */}
              <Animated.View style={[styles.pinRow, { transform: [{ translateX: shakeAnim }] }]}>
                {[0, 1, 2, 3].map((i) => {
                  const filled = mpin.length > i;
                  const current = mpin.length === i && focusedInput === 'mpin';
                  return (
                    <Pressable
                      key={i}
                      onPress={() => mpinInputRef.current?.focus()}
                      style={[
                        styles.pinBox,
                        { backgroundColor: inputBg, borderColor: border },
                        current && { borderColor: PURPLE, backgroundColor: isDarkMode ? `${PURPLE}22` : PURPLE_LIGHT },
                        filled && { borderColor: PURPLE },
                        mpinError && { borderColor: '#EF4444' },
                      ]}
                    >
                      {filled
                        ? showMpin
                          ? <Text style={[styles.pinDigit, { color: textMain }]}>{mpin[i]}</Text>
                          : <View style={[styles.pinDot, { backgroundColor: PURPLE }]} />
                        : <View style={[styles.pinEmptyDot, { backgroundColor: isDarkMode ? '#2D3454' : '#CBD5E1' }]} />
                      }
                    </Pressable>
                  );
                })}
              </Animated.View>

              {/* Controls */}
              <View style={styles.pinControls}>
                <TouchableOpacity
                  style={[styles.eyePill, { backgroundColor: isDarkMode ? `${PURPLE}22` : PURPLE_LIGHT }]}
                  onPress={() => setShowMpin(!showMpin)}
                >
                  {showMpin ? <EyeOff size={13} color={PURPLE} /> : <Eye size={13} color={PURPLE} />}
                  <Text style={styles.eyePillText}>{showMpin ? 'Hide' : 'Show'} PIN</Text>
                </TouchableOpacity>
                {loading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ActivityIndicator size="small" color={PURPLE} />
                    <Text style={{ color: PURPLE, fontWeight: '700', fontSize: 12 }}>Verifying...</Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={handleForgotMpin}>
                    <Text style={styles.footerLink}>Forgot MPIN?</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Error */}
              {Boolean(mpinError) && (
                <View style={[styles.errorBox, { backgroundColor: isDarkMode ? 'rgba(239,68,68,0.12)' : '#FEF2F2', borderColor: isDarkMode ? 'rgba(239,68,68,0.3)' : '#FCA5A5' }]}>
                  <AlertCircle size={14} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text style={styles.errorText}>{mpinError}</Text>
                </View>
              )}

              {/* Sign In button */}
              <TouchableOpacity
                style={{ opacity: (mpin.length === 4 && !loading) ? 1 : 0.5, marginTop: 14 }}
                onPress={() => handleMpinSubmit(mpin)}
                disabled={mpin.length !== 4 || loading}
                activeOpacity={0.88}
              >
                <LinearGradient colors={[PURPLE, '#8B6FFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtn}>
                  {loading ? <ActivityIndicator size="small" color="#FFF" /> : (
                    <><Text style={styles.ctaText}>Sign In with MPIN</Text><ArrowRight size={18} color="#FFF" style={{ marginLeft: 8 }} /></>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* OTP option */}
              <TouchableOpacity style={styles.otpLink} onPress={handleDirectOtpLogin}>
                <MessageSquare size={14} color={PURPLE} />
                <Text style={[styles.footerText, { color: textSub }]}>
                  {' '}Sign in with <Text style={styles.footerLink}>OTP instead</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        {alertEl}
      </View>
    );
  }

  // ══════════════════════════════════════════
  // STEP: RESET_MPIN
  // ══════════════════════════════════════════
  return (
    <View style={[styles.root, { backgroundColor: isDarkMode ? '#0C0E1A' : '#FFF' }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
          <LinearGradient colors={[PURPLE, '#8B6FFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: topPad + 18 }]}>
            <View style={styles.blob1} /><View style={styles.blob2} />
            <View style={styles.brandRow}>
              <KwicklyIcon size={38} />
              <Text style={styles.brandName}>Kwick<Text style={{ color: '#FFD580' }}>ly</Text></Text>
            </View>
            <Text style={styles.heroTitle}>Reset MPIN</Text>
            <Text style={styles.heroSub}>Enter the OTP sent to +91 {phone}</Text>
          </LinearGradient>

          <View style={[styles.card, { backgroundColor: cardBg, paddingBottom: bottomPad + 16 }]}>
            {/* OTP */}
            <Text style={[styles.label, { color: textSub }]}>Verification OTP</Text>
            <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: focusedInput === 'resetOtp' ? PURPLE : border, marginBottom: 14 }, focusedInput === 'resetOtp' && styles.inputFocusShadow]}>
              <MessageSquare size={16} color={focusedInput === 'resetOtp' ? PURPLE : textSub} style={{ marginRight: 10 }} />
              <TextInput
                style={[styles.inputText, { color: textMain, letterSpacing: resetOtp.length > 0 ? 8 : 0, fontWeight: '800' }]}
                placeholder="4-digit OTP"
                placeholderTextColor={textSub}
                keyboardType="phone-pad"
                maxLength={4}
                value={resetOtp}
                onChangeText={(t) => setResetOtp(t.replace(/\D/g, '').slice(0, 4))}
                onFocus={() => setFocusedInput('resetOtp')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>

            {/* New MPIN */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.label, { color: textSub }]}>New 4-Digit MPIN</Text>
              <TouchableOpacity onPress={() => setShowNewMpin(!showNewMpin)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {showNewMpin ? <EyeOff size={14} color={PURPLE} /> : <Eye size={14} color={PURPLE} />}
                <Text style={styles.footerLink}>{showNewMpin ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: focusedInput === 'newMpin' ? PURPLE : border, marginBottom: 14 }, focusedInput === 'newMpin' && styles.inputFocusShadow]}>
              <Lock size={16} color={focusedInput === 'newMpin' ? PURPLE : textSub} style={{ marginRight: 10 }} />
              <TextInput
                style={[styles.inputText, { color: textMain, letterSpacing: newMpin.length > 0 ? 8 : 0, fontWeight: '800' }]}
                placeholder="New MPIN"
                placeholderTextColor={textSub}
                keyboardType="phone-pad"
                maxLength={4}
                secureTextEntry={!showNewMpin}
                value={newMpin}
                onChangeText={(t) => setNewMpin(t.replace(/\D/g, '').slice(0, 4))}
                onFocus={() => setFocusedInput('newMpin')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>

            {/* Confirm MPIN */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.label, { color: textSub }]}>Confirm New MPIN</Text>
              {isResetMatched && <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 12 }}>✓ Match</Text>}
              {isResetMismatched && <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 12 }}>✗ Mismatch</Text>}
            </View>
            <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: isResetMatched ? '#10B981' : focusedInput === 'confirmMpin' ? PURPLE : border, marginBottom: 20 }, focusedInput === 'confirmMpin' && styles.inputFocusShadow]}>
              <ShieldCheck size={16} color={isResetMatched ? '#10B981' : (focusedInput === 'confirmMpin' ? PURPLE : textSub)} style={{ marginRight: 10 }} />
              <TextInput
                style={[styles.inputText, { color: textMain, letterSpacing: confirmNewMpin.length > 0 ? 8 : 0, fontWeight: '800' }]}
                placeholder="Re-enter MPIN"
                placeholderTextColor={textSub}
                keyboardType="phone-pad"
                maxLength={4}
                secureTextEntry={!showNewMpin}
                value={confirmNewMpin}
                onChangeText={(t) => setConfirmNewMpin(t.replace(/\D/g, '').slice(0, 4))}
                onFocus={() => setFocusedInput('confirmMpin')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>

            <TouchableOpacity
              style={{ opacity: (resetOtp.length === 4 && isResetMatched && !loading) ? 1 : 0.5 }}
              onPress={handleResetMpin}
              disabled={resetOtp.length !== 4 || !isResetMatched || loading}
              activeOpacity={0.88}
            >
              <LinearGradient colors={[PURPLE, '#8B6FFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtn}>
                {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.ctaText}>Reset MPIN & Sign In</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={{ alignItems: 'center', marginTop: 16 }} onPress={() => setStep('MPIN')}>
              <Text style={styles.footerLink}>Back to MPIN sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {alertEl}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    overflow: 'hidden',
  },
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.4,
  },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#FFF', letterSpacing: -0.4, marginBottom: 4 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500', marginBottom: 12 },
  trustPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  trustPillText: { fontSize: 11.5, color: '#FFF', fontWeight: '600' },
  rolePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, gap: 4,
  },
  rolePillText: { fontSize: 12, color: '#FFF', fontWeight: '700' },
  rolePillSep: { color: 'rgba(255,255,255,0.5)' },

  // Card
  card: {
    flex: 1, paddingHorizontal: 20, paddingTop: 22,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 5,
  },
  cardHeading: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  cardSub: { fontSize: 13, marginTop: 3 },

  // Input
  label: { fontSize: 11.5, fontWeight: '700', marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 14, height: 52, paddingHorizontal: 12,
  },
  inputFocusShadow: {
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 2,
  },
  inputText: {
    flex: 1, fontSize: 16, fontWeight: '700',
    height: '100%', paddingVertical: 0,
  },
  prefixBox: {
    justifyContent: 'center',
  },
  prefix: {
    fontSize: 14, fontWeight: '800',
    marginRight: 10, paddingRight: 10, borderRightWidth: 1,
  },

  // CTA
  ctaBtn: {
    height: 52, borderRadius: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  ctaText: { color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 },

  footerText: { fontSize: 13 },
  footerLink: { color: PURPLE, fontWeight: '800' },
  trustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  trustText: { fontSize: 11.5 },

  // Role select step
  accountCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 16, borderWidth: 1.5,
    marginBottom: 10,
  },
  accountIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  accountRole: { fontSize: 15, fontWeight: '800' },
  accountName: { fontSize: 12.5, marginTop: 2 },

  // MPIN step
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  pinRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 20 },
  pinBox: {
    width: 58, height: 58, borderRadius: 16, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  pinDigit: { fontSize: 22, fontWeight: '900' },
  pinDot: { width: 14, height: 14, borderRadius: 7 },
  pinEmptyDot: { width: 8, height: 8, borderRadius: 4 },
  pinControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  eyePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 5 },
  eyePillText: { fontSize: 12, fontWeight: '700', color: PURPLE },
  errorBox: {
    flexDirection: 'row', alignItems: 'center',
    padding: 10, borderRadius: 10, borderWidth: 1,
    marginBottom: 8,
  },
  errorText: { color: '#EF4444', fontSize: 12.5, fontWeight: '600', flex: 1 },
  otpLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, paddingVertical: 4 },
});

export default LoginScreen;
