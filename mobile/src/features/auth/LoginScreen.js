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
  Sparkles,
  KeyRound,
} from 'lucide-react-native';
import { authService } from '../../services/authService';
import { getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import CustomAlert from '../../components/ui/CustomAlert';
import LinearGradient from 'react-native-linear-gradient';

const { width: SW, height: SH } = Dimensions.get('window');

const PURPLE = '#6C47FF';
const PURPLE_LIGHT = '#F5F3FF';

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

  const phoneInputRef = useRef(null);
  const mpinInputRef = useRef(null);
  const isCheckingRef = useRef(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (prefillPhone && prefillPhone.length === 10) handleCheckNumber(prefillPhone);
  }, []); // eslint-disable-line

  useEffect(() => {
    if (step === 'MPIN') {
      setMpin('');
      setMpinError('');
      const t = setTimeout(() => mpinInputRef.current?.focus(), 320);
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

  // Step 1: Check phone number
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
    if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
    else if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
    digits = digits.slice(0, 10);
    setPhone(digits);
    if (digits.length === 10) {
      Keyboard.dismiss();
      handleCheckNumber(digits);
    }
  };

  const handleAutoSendOtp = async (phoneNumber, targetRole) => {
    setLoading(true);
    try {
      await authService.sendOtp(phoneNumber, targetRole);
      navigation.navigate('OTPVerify', { phone: phoneNumber, role: targetRole });
    } catch (error) {
      showAlert('Error', getApiErrorMessage(error, 'Failed to send OTP. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccount = (acc) => {
    setSelectedRole(acc.role);
    setDetectedName(acc.name);
    if (acc.hasMpin) {
      setStep('MPIN');
    } else {
      handleAutoSendOtp(phone, acc.role);
    }
  };

  const handleMpinSubmit = async (explicitPin) => {
    const pinToUse = explicitPin || mpin;
    if (!pinToUse || pinToUse.length !== 4) return;
    setLoading(true);
    setMpinError('');
    try {
      const response = await authService.loginWithMpin(phone, selectedRole, pinToUse);
      const data = response?.data?.data || response?.data || {};
      const { token, user } = data;
      if (!token) throw new Error('Authentication failed. No token received.');
      await signIn(token, selectedRole, user);
    } catch (error) {
      triggerShake();
      setMpin('');
      const status = error.response?.status;
      const msg = getApiErrorMessage(error, '');
      if (status === 401 || msg.toLowerCase().includes('mpin') || msg.toLowerCase().includes('password') || msg.toLowerCase().includes('invalid')) {
        setMpinError('Incorrect MPIN. Please try again.');
      } else {
        setMpinError(msg || 'Sign in failed. Please try again.');
      }
      setTimeout(() => mpinInputRef.current?.focus(), 150);
    } finally {
      setLoading(false);
    }
  };

  const handleMpinChange = (text) => {
    const clean = text.replace(/\D/g, '').slice(0, 4);
    setMpin(clean);
    setMpinError('');
    if (clean.length === 4) {
      Keyboard.dismiss();
      handleMpinSubmit(clean);
    }
  };

  const handleForgotMpin = async () => {
    setLoading(true);
    try {
      await authService.forgotPassword(phone, selectedRole);
      setStep('RESET_MPIN');
      setResetOtp('');
      setNewMpin('');
      setConfirmNewMpin('');
      showAlert('OTP Sent', `A verification code was sent to +91 ${phone} to reset your MPIN.`, 'info');
    } catch (error) {
      showAlert('Error', getApiErrorMessage(error, 'Failed to send reset code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetMpin = async () => {
    if (resetOtp.length !== 4) { showAlert('Invalid OTP', 'Please enter the 4-digit OTP.'); return; }
    if (newMpin.length !== 4) { showAlert('Invalid MPIN', 'New MPIN must be 4 digits.'); return; }
    if (newMpin !== confirmNewMpin) { showAlert('Mismatch', 'New MPIN and confirm MPIN do not match.'); return; }
    setLoading(true);
    try {
      await authService.resetPasswordWithOtp(phone, resetOtp, newMpin, selectedRole);
      showAlert(
        'Success',
        'MPIN reset successfully! Logging you in...',
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

  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const safeTopPadding = Math.max(insets.top, statusBarHeight) + 14;
  const safeBottomPadding = Math.max(insets.bottom, 16);

  const cardBg = isDarkMode ? '#131B2E' : '#FFFFFF';
  const cardBorder = isDarkMode ? '#1E293B' : '#EDF0F7';
  const textMain = isDarkMode ? '#F8FAFC' : '#0F172A';
  const textSub = isDarkMode ? '#94A3B8' : '#64748B';
  const inputBg = isDarkMode ? '#0B1120' : '#F8FAFC';
  const inputBorder = isDarkMode ? '#1E293B' : '#E2E8F0';

  const currentRoleMeta = ROLE_META[selectedRole] || ROLE_META.CUSTOMER;
  const RoleIcon = currentRoleMeta.icon;

  const isResetMatched = newMpin.length === 4 && confirmNewMpin.length === 4 && newMpin === confirmNewMpin;
  const isResetMismatched = confirmNewMpin.length === 4 && newMpin.length === 4 && newMpin !== confirmNewMpin;

  // Background Layout Wrapper (HomeScreen aesthetic)
  const renderBackground = () => (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <LinearGradient
        colors={
          isDarkMode
            ? ['#0B0F19', '#111827', '#0B0F19']
            : ['#FFFFFF', '#F6F8FC', '#EEF2FF', '#FFFFFF']
        }
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.bgOrbTopLeft}>
        <LinearGradient colors={['#8B5CF6', '#6C47FF']} style={StyleSheet.absoluteFill} />
      </View>
      <View pointerEvents="none" style={styles.bgOrbBottomRight}>
        <LinearGradient colors={['#3B82F6', '#6C47FF']} style={StyleSheet.absoluteFill} />
      </View>
    </>
  );

  const alertEl = (
    <CustomAlert
      visible={alertConfig.visible}
      title={alertConfig.title}
      message={alertConfig.message}
      type={alertConfig.type}
      onConfirm={dismissAlert}
      onRequestClose={dismissAlert}
    />
  );

  // ══════════════════════════════════════════
  // STEP 1: PHONE
  // ══════════════════════════════════════════
  if (step === 'PHONE') {
    return (
      <View style={[styles.root, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8F9FD' }]}>
        {renderBackground()}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingTop: safeTopPadding, paddingBottom: safeBottomPadding }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Top Brand Header */}
            <View style={styles.headerBlock}>
              <View style={styles.logoRow}>
                <KwicklyIcon size={38} />
                <Text style={[styles.wordmark, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                  Kwick<Text style={{ color: '#6C47FF' }}>ly</Text>
                </Text>
              </View>

              <View style={[styles.pillBadge, { backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#FFFFFF', borderColor: isDarkMode ? 'rgba(108, 71, 255, 0.3)' : '#E2E8F0' }]}>
                <Sparkles size={12} color="#6C47FF" />
                <Text style={[styles.pillText, { color: isDarkMode ? '#C4B5FD' : '#475569' }]}>
                  Auto-Detects Your Account · Secure
                </Text>
              </View>

              <Text style={[styles.title, { color: textMain }]}>
                Welcome <Text style={{ color: '#6C47FF' }}>Back!</Text>
              </Text>
              <Text style={[styles.subtitle, { color: textSub }]}>
                Sign in to continue your journey
              </Text>
            </View>

            {/* Floating Form Card */}
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[styles.fieldLabel, { color: textSub }]}>MOBILE NUMBER</Text>
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => phoneInputRef.current?.focus()}
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: inputBg,
                    borderColor: phone.length === 10 ? '#10B981' : focusedInput === 'phone' ? PURPLE : inputBorder,
                  },
                  focusedInput === 'phone' && styles.inputFocusGlow,
                ]}
              >
                <View pointerEvents="none" style={styles.prefixWrapper}>
                  <Text style={styles.flagText}>🇮🇳</Text>
                  <Text style={[styles.prefixNumber, { color: textMain }]}>+91</Text>
                  <View style={[styles.prefixDivider, { backgroundColor: inputBorder }]} />
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

              {/* Continue Button */}
              <TouchableOpacity
                style={[styles.btnShadow, { opacity: (phone.length === 10 && !loading) ? 1 : 0.45, marginTop: 20 }]}
                onPress={() => handleCheckNumber()}
                disabled={phone.length !== 10 || loading}
                activeOpacity={0.88}
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
                      <Text style={styles.ctaText}>Continue</Text>
                      <ArrowRight size={18} color="#FFF" style={{ marginLeft: 8 }} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Secondary Navigation */}
              <View style={styles.footerRow}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('RoleSelection', { prefillPhone: phone })}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.footerText, { color: textSub }]}>
                    New to Kwickly? <Text style={[styles.footerLink, { color: PURPLE }]}>Create Account</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bottom Trust Badge */}
            <View style={styles.trustFooter}>
              <ShieldCheck size={14} color="#10B981" />
              <Text style={[styles.trustText, { color: textSub }]}>
                100% Encrypted · Instant MPIN · 🇮🇳 India
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        {alertEl}
      </View>
    );
  }

  // ══════════════════════════════════════════
  // STEP 2: SELECT_ROLE (Multi Profile)
  // ══════════════════════════════════════════
  if (step === 'SELECT_ROLE') {
    return (
      <View style={[styles.root, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8F9FD' }]}>
        {renderBackground()}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingTop: safeTopPadding, paddingBottom: safeBottomPadding }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.headerBlock}>
              <View style={styles.logoRow}>
                <KwicklyIcon size={38} />
                <Text style={[styles.wordmark, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                  Kwick<Text style={{ color: '#6C47FF' }}>ly</Text>
                </Text>
              </View>

              <View style={[styles.pillBadge, { backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#FFFFFF', borderColor: isDarkMode ? 'rgba(108, 71, 255, 0.3)' : '#E2E8F0' }]}>
                <User size={12} color="#6C47FF" />
                <Text style={[styles.pillText, { color: isDarkMode ? '#C4B5FD' : '#475569' }]}>
                  Multiple Profiles Found
                </Text>
              </View>

              <Text style={[styles.title, { color: textMain }]}>
                Select <Text style={{ color: '#6C47FF' }}>Profile</Text>
              </Text>
              <Text style={[styles.subtitle, { color: textSub }]}>
                Accounts linked with +91 {phone}
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              {availableAccounts.map((acc, idx) => {
                const meta = ROLE_META[acc.role] || ROLE_META.CUSTOMER;
                const Icon = meta.icon;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.accountCard, { backgroundColor: inputBg, borderColor: inputBorder }]}
                    onPress={() => handleSelectAccount(acc)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.accountIconWrap, { backgroundColor: meta.bg }]}>
                      <Icon size={20} color={meta.color} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.accountRole, { color: textMain }]}>{meta.label}</Text>
                      <Text style={[styles.accountName, { color: textSub }]}>{acc.name || 'Registered Profile'}</Text>
                    </View>
                    <ArrowRight size={16} color={textSub} />
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity style={{ alignItems: 'center', marginTop: 16 }} onPress={() => setStep('PHONE')}>
                <Text style={[styles.footerLink, { color: PURPLE }]}>Use a different number</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        {alertEl}
      </View>
    );
  }

  // ══════════════════════════════════════════
  // STEP 3: MPIN
  // ══════════════════════════════════════════
  if (step === 'MPIN') {
    return (
      <View style={[styles.root, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8F9FD' }]}>
        {renderBackground()}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingTop: safeTopPadding, paddingBottom: safeBottomPadding }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Top Brand Header */}
            <View style={styles.headerBlock}>
              <View style={styles.logoRow}>
                <KwicklyIcon size={38} />
                <Text style={[styles.wordmark, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                  Kwick<Text style={{ color: '#6C47FF' }}>ly</Text>
                </Text>
              </View>

              <View style={[styles.pillBadge, { backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#FFFFFF', borderColor: isDarkMode ? 'rgba(108, 71, 255, 0.3)' : '#E2E8F0' }]}>
                <Lock size={12} color="#6C47FF" />
                <Text style={[styles.pillText, { color: isDarkMode ? '#C4B5FD' : '#475569' }]}>
                  Instant MPIN Sign In
                </Text>
              </View>

              <Text style={[styles.title, { color: textMain }]}>
                Welcome <Text style={{ color: '#6C47FF' }}>{detectedName || 'Back'}!</Text>
              </Text>

              {/* Profile Chip with Edit Button */}
              <TouchableOpacity
                style={[styles.profilePill, { backgroundColor: isDarkMode ? '#1E2540' : '#F0F2FF', borderColor: isDarkMode ? '#2D3760' : '#E0E4FF' }]}
                onPress={() => setStep('PHONE')}
                activeOpacity={0.75}
              >
                <RoleIcon size={13} color={PURPLE} />
                <Text style={[styles.profilePillText, { color: PURPLE }]}>{currentRoleMeta.label} · +91 {phone}</Text>
                <Edit3 size={11} color={PURPLE} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>

            {/* Floating Form Card */}
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              {/* Hidden Real Input */}
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

              <Text style={[styles.cardHeading, { color: textMain }]}>Enter 4-Digit MPIN</Text>
              <Text style={[styles.cardSubheading, { color: textSub }]}>Tap to enter your security PIN</Text>

              {/* PIN Boxes (HomeScreen Standard) */}
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
                        { backgroundColor: inputBg, borderColor: inputBorder },
                        current && styles.pinBoxActiveGlow,
                        filled && { borderColor: PURPLE },
                        mpinError && { borderColor: '#EF4444' },
                      ]}
                    >
                      {filled ? (
                        showMpin ? (
                          <Text style={[styles.pinDigit, { color: textMain }]}>{mpin[i]}</Text>
                        ) : (
                          <View style={[styles.pinDot, { backgroundColor: PURPLE }]} />
                        )
                      ) : (
                        <View style={[styles.pinEmptyDot, { backgroundColor: isDarkMode ? '#2D3454' : '#CBD5E1' }]} />
                      )}
                    </Pressable>
                  );
                })}
              </Animated.View>

              {/* Eye Toggle & Forgot MPIN */}
              <View style={styles.pinControls}>
                <TouchableOpacity
                  style={[styles.eyePill, { backgroundColor: isDarkMode ? `${PURPLE}22` : PURPLE_LIGHT }]}
                  onPress={() => setShowMpin(!showMpin)}
                >
                  {showMpin ? <EyeOff size={13} color={PURPLE} /> : <Eye size={13} color={PURPLE} />}
                  <Text style={[styles.eyePillText, { color: PURPLE }]}>{showMpin ? 'Hide' : 'Show'} PIN</Text>
                </TouchableOpacity>

                {loading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ActivityIndicator size="small" color={PURPLE} />
                    <Text style={{ color: PURPLE, fontWeight: '700', fontSize: 12 }}>Verifying...</Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={handleForgotMpin}>
                    <Text style={[styles.footerLink, { color: PURPLE }]}>Forgot MPIN?</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Error Message */}
              {Boolean(mpinError) && (
                <View style={[styles.errorBox, { backgroundColor: isDarkMode ? 'rgba(239,68,68,0.12)' : '#FEF2F2', borderColor: isDarkMode ? 'rgba(239,68,68,0.3)' : '#FCA5A5' }]}>
                  <AlertCircle size={14} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text style={styles.errorText}>{mpinError}</Text>
                </View>
              )}

              {/* Sign In CTA */}
              <TouchableOpacity
                style={[styles.btnShadow, { opacity: (mpin.length === 4 && !loading) ? 1 : 0.45, marginTop: 14 }]}
                onPress={() => handleMpinSubmit(mpin)}
                disabled={mpin.length !== 4 || loading}
                activeOpacity={0.88}
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
                      <Text style={styles.ctaText}>Sign In with MPIN</Text>
                      <ArrowRight size={18} color="#FFF" style={{ marginLeft: 8 }} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Sign in with OTP option */}
              <TouchableOpacity style={styles.otpLink} onPress={handleDirectOtpLogin} activeOpacity={0.75}>
                <MessageSquare size={14} color={PURPLE} />
                <Text style={[styles.footerText, { color: textSub }]}>
                  {' '}Sign in with <Text style={[styles.footerLink, { color: PURPLE }]}>OTP instead</Text>
                </Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Trust Badge */}
            <View style={styles.trustFooter}>
              <ShieldCheck size={14} color="#10B981" />
              <Text style={[styles.trustText, { color: textSub }]}>
                Bank-grade 256-bit encryption · 100% Secure
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        {alertEl}
      </View>
    );
  }

  // ══════════════════════════════════════════
  // STEP 4: RESET_MPIN
  // ══════════════════════════════════════════
  return (
    <View style={[styles.root, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8F9FD' }]}>
      {renderBackground()}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: safeTopPadding, paddingBottom: safeBottomPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.headerBlock}>
            <View style={styles.logoRow}>
              <KwicklyIcon size={38} />
              <Text style={[styles.wordmark, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                Kwick<Text style={{ color: '#6C47FF' }}>ly</Text>
              </Text>
            </View>

            <View style={[styles.pillBadge, { backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#FFFFFF', borderColor: isDarkMode ? 'rgba(108, 71, 255, 0.3)' : '#E2E8F0' }]}>
              <KeyRound size={12} color="#6C47FF" />
              <Text style={[styles.pillText, { color: isDarkMode ? '#C4B5FD' : '#475569' }]}>
                MPIN Recovery
              </Text>
            </View>

            <Text style={[styles.title, { color: textMain }]}>
              Reset <Text style={{ color: '#6C47FF' }}>MPIN</Text>
            </Text>
            <Text style={[styles.subtitle, { color: textSub }]}>
              Enter OTP sent to +91 {phone}
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            {/* OTP Input */}
            <Text style={[styles.fieldLabel, { color: textSub }]}>VERIFICATION OTP</Text>
            <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor: focusedInput === 'resetOtp' ? PURPLE : inputBorder, marginBottom: 14 }]}>
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
              <Text style={[styles.fieldLabel, { color: textSub }]}>NEW 4-DIGIT MPIN</Text>
              <TouchableOpacity onPress={() => setShowNewMpin(!showNewMpin)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {showNewMpin ? <EyeOff size={13} color={PURPLE} /> : <Eye size={13} color={PURPLE} />}
                <Text style={[styles.footerLink, { color: PURPLE, fontSize: 12 }]}>{showNewMpin ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor: focusedInput === 'newMpin' ? PURPLE : inputBorder, marginBottom: 14 }]}>
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
              <Text style={[styles.fieldLabel, { color: textSub }]}>CONFIRM NEW MPIN</Text>
              {isResetMatched && <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 12 }}>✓ Matched</Text>}
              {isResetMismatched && <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 12 }}>✗ Does not match</Text>}
            </View>
            <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor: isResetMatched ? '#10B981' : focusedInput === 'confirmMpin' ? PURPLE : inputBorder, marginBottom: 20 }]}>
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

            {/* Reset CTA */}
            <TouchableOpacity
              style={[styles.btnShadow, { opacity: (resetOtp.length === 4 && isResetMatched && !loading) ? 1 : 0.45 }]}
              onPress={handleResetMpin}
              disabled={resetOtp.length !== 4 || !isResetMatched || loading}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={[PURPLE, '#582BE8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaBtn}
              >
                {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.ctaText}>Reset MPIN & Sign In</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={{ alignItems: 'center', marginTop: 16 }} onPress={() => setStep('MPIN')}>
              <Text style={[styles.footerLink, { color: PURPLE }]}>Back to MPIN sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {alertEl}
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
    bottom: SH * 0.10,
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
    justifyContent: 'center',
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
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 3,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
    gap: 5,
  },
  profilePillText: {
    fontSize: 12.5,
    fontWeight: '700',
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
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  inputContainer: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  inputFocusGlow: {
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 0,
  },
  prefixWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  flagText: {
    fontSize: 16,
    marginRight: 4,
  },
  prefixNumber: {
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },
  prefixDivider: {
    width: 1,
    height: 22,
    marginRight: 4,
  },
  btnShadow: {
    width: '100%',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  footerRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footerLink: {
    fontWeight: '800',
  },
  trustFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  trustText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  accountIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountRole: {
    fontSize: 15,
    fontWeight: '800',
  },
  accountName: {
    fontSize: 12.5,
    marginTop: 2,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 18,
  },
  pinBox: {
    width: Math.min(SW * 0.15, 62),
    height: Math.min(SW * 0.16, 64),
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBoxActiveGlow: {
    borderColor: PURPLE,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  pinDigit: {
    fontSize: 22,
    fontWeight: '900',
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  pinEmptyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pinControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eyePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  eyePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  otpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 4,
  },
});

export default LoginScreen;
