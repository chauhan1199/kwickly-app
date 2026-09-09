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
  Image,
  Easing,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
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
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Zap,
} from 'lucide-react-native';
import { authService } from '../../services/authService';
import { getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import CustomAlert from '../../components/ui/CustomAlert';
import LinearGradient from 'react-native-linear-gradient';

const { width: SW, height: SH } = Dimensions.get('window');

const ROLE_META = {
  CUSTOMER: { label: 'Customer', icon: User, color: '#7C47FF', bg: 'rgba(124, 71, 255, 0.12)' },
  WORKER: { label: 'Worker / Pro', icon: Wrench, color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
  SHOP: { label: 'Shop Owner', icon: Store, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
};

const LoginScreen = ({ navigation, route }) => {
  const { role: initialRole = null, prefillPhone = '' } = route.params || {};
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [step, setStep] = useState('PHONE');
  const [phone, setPhone] = useState(prefillPhone);
  const [selectedRole, setSelectedRole] = useState(initialRole || 'CUSTOMER');
  const [detectedName, setDetectedName] = useState('');
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [, setHasMpinSet] = useState(true);

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

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const phoneInputRef = useRef(null);
  const mpinInputRef = useRef(null);
  const isCheckingPhoneRef = useRef(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    if (prefillPhone && prefillPhone.length === 10) handleCheckNumber(prefillPhone);
  }, [prefillPhone]);

  useEffect(() => {
    if (step === 'MPIN') {
      setMpin('');
      setMpinError('');
      const t = setTimeout(() => mpinInputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [step]);

  const handleCheckNumber = async (numberToCheck) => {
    const targetPhone = (numberToCheck || phone || '').replace(/\D/g, '');
    if (!targetPhone || targetPhone.length !== 10) {
      showAlert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (isCheckingPhoneRef.current) return;
    isCheckingPhoneRef.current = true;
    setLoading(true);
    try {
      const response = await authService.checkStatus(targetPhone);
      const data = response?.data?.data || response?.data || {};
      if (!data.exists) {
        showAlert('Account Not Found', `No Kwickly profile found for +91 ${targetPhone}. Would you like to create a new account?`, 'info', () => {
          navigation.navigate('RoleSelection', { prefillPhone: targetPhone });
        });
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
        setHasMpinSet(acc.hasMpin);
        if (acc.hasMpin) {
          setStep('MPIN');
        } else {
          handleAutoSendOtpForMpin(targetPhone, acc.role);
        }
      }
    } catch (error) {
      showAlert('Sign In Failed', getApiErrorMessage(error, 'Could not verify mobile number. Please try again.'));
    } finally {
      setLoading(false);
      isCheckingPhoneRef.current = false;
    }
  };

  const handlePhoneChange = (text) => {
    const clean = (text || '').replace(/[^0-9]/g, '').slice(0, 10);
    setPhone(clean);
    if (mpinError) setMpinError('');
    if (clean.length === 10) { Keyboard.dismiss(); handleCheckNumber(clean); }
  };

  const handleAutoSendOtpForMpin = (targetPhone, role) => {
    showAlert('MPIN Not Configured', 'An MPIN has not been set for this account. We will send an OTP so you can sign in and set your 4-digit MPIN.', 'info', async () => {
      setLoading(true);
      try {
        await authService.sendOtp(targetPhone, role);
        navigation.navigate('OTPVerify', { phone: targetPhone, role });
      } catch (err) {
        showAlert('OTP Error', getApiErrorMessage(err, 'Failed to send OTP. Please try again.'));
      } finally {
        setLoading(false);
      }
    });
  };

  const handleSelectAccount = (acc) => {
    setSelectedRole(acc.role);
    setDetectedName(acc.name);
    setHasMpinSet(acc.hasMpin);
    if (acc.hasMpin) { setStep('MPIN'); } else { handleAutoSendOtpForMpin(phone, acc.role); }
  };

  const handleMpinSubmit = async (pinValue) => {
    const targetPin = pinValue || mpin;
    if (!targetPin || targetPin.length !== 4) { setMpinError('Please enter your 4-digit Security MPIN.'); triggerShake(); return; }
    setLoading(true);
    setMpinError('');
    try {
      const response = await authService.login(phone, targetPin, selectedRole);
      const { token, user } = response.data.data;
      await signIn(token, user.role, user);
    } catch (error) {
      const errorData = error.response?.data;
      const isMpinNotSet = errorData?.mpinNotSet || errorData?.message?.toLowerCase()?.includes('mpin is not set') || errorData?.message?.toLowerCase()?.includes('password is not set');
      if (isMpinNotSet) {
        handleAutoSendOtpForMpin(phone, selectedRole);
      } else {
        const errorMsg = errorData?.errors?.join(', ') || errorData?.message || error.message || 'Incorrect MPIN. Please try again.';
        setMpinError(errorMsg);
        triggerShake();
        setMpin('');
        setTimeout(() => mpinInputRef.current?.focus(), 120);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMpinChange = (text) => {
    const clean = text.replace(/[^0-9]/g, '').slice(0, 4);
    setMpin(clean);
    if (mpinError) setMpinError('');
    if (clean.length === 4) handleMpinSubmit(clean);
  };

  const handleDirectOtpLogin = async () => {
    setLoading(true);
    try {
      await authService.sendOtp(phone, selectedRole);
      navigation.navigate('OTPVerify', { phone, role: selectedRole });
    } catch (error) {
      showAlert('OTP Error', getApiErrorMessage(error, 'Failed to send verification OTP. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateForgotMpin = async () => {
    setLoading(true);
    try {
      await authService.forgotMpin(phone, selectedRole);
      setResetOtp(''); setNewMpin(''); setConfirmNewMpin('');
      setStep('RESET_MPIN');
    } catch (error) {
      showAlert('Reset MPIN Error', getApiErrorMessage(error, 'Failed to send reset code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteResetMpin = async () => {
    const cleanOtp = (resetOtp || '').trim();
    if (!cleanOtp || cleanOtp.length !== 4) { showAlert('Invalid OTP', 'Please enter the 4-digit OTP code sent to your phone.'); return; }
    if (!newMpin || newMpin.length !== 4) { showAlert('Invalid MPIN', 'New MPIN must be exactly 4 numeric digits.'); return; }
    if (newMpin !== confirmNewMpin) { showAlert('MPIN Mismatch', 'New MPIN and confirmation MPIN do not match.'); return; }
    setLoading(true);
    try {
      await authService.resetMpin(phone, cleanOtp, newMpin, selectedRole);
      const loginRes = await authService.login(phone, newMpin, selectedRole);
      const { token, user } = loginRes.data.data;
      showAlert('MPIN Updated', 'Your MPIN was successfully reset. Logging you in...', 'success', async () => { await signIn(token, user.role, user); });
    } catch (error) {
      showAlert('Reset Failed', getApiErrorMessage(error, 'Failed to reset MPIN. Please verify the 4-digit OTP code and try again.'));
    } finally {
      setLoading(false);
    }
  };

  const topPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
  const bottomPad = Math.max(insets.bottom, 16);

  const currentRoleMeta = ROLE_META[selectedRole] || ROLE_META.CUSTOMER;
  const RoleIcon = currentRoleMeta.icon;
  const isResetMatched = newMpin.length === 4 && confirmNewMpin.length === 4 && newMpin === confirmNewMpin;
  const isResetMismatched = confirmNewMpin.length === 4 && newMpin.length === 4 && newMpin !== confirmNewMpin;

  // Colors
  const bg = isDarkMode ? '#0C0E1A' : '#F0F2FF';
  const cardBg = isDarkMode ? '#13172A' : '#FFFFFF';
  const border = isDarkMode ? '#1E2540' : '#E4E8FF';
  const textMain = isDarkMode ? '#F1F2FF' : '#111827';
  const textSub = isDarkMode ? '#7B83B0' : '#6B7280';
  const inputBg = isDarkMode ? '#0A0D1C' : '#F8F9FF';

  // ─── STEP: PHONE ───
  if (step === 'PHONE') {
    return (
      <View style={[s.root, { backgroundColor: bg }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <LinearGradient
          colors={['#5B2FD4', '#7C47FF', '#9B6BFF']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.hero, { paddingTop: topPad + 28 }]}
        >
          <View style={s.brandRow}>
            <View style={s.brandDot} />
            <Text style={s.brandName}>Kwick<Text style={{ color: '#FFD580' }}>ly</Text></Text>
          </View>
          <Text style={s.heroTitle}>Welcome Back!</Text>
          <Text style={s.heroSub}>Sign in to continue your journey</Text>
          <View style={[s.trustPill, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <Zap size={12} color="#FFD580" />
            <Text style={s.trustPillText}>Auto-detects your account • Fast & Secure</Text>
          </View>
        </LinearGradient>

        <View style={[s.formArea, { backgroundColor: cardBg, paddingBottom: bottomPad + 16 }]}>
          <Text style={[s.sectionTitle, { color: textMain }]}>Enter Mobile Number</Text>
          <Text style={[s.sectionSub, { color: textSub }]}>We'll find your account automatically</Text>

          <View style={[s.inputRow, { backgroundColor: inputBg, borderColor: focusedInput === 'phone' ? '#7C47FF' : (phone.length === 10 ? '#10B981' : border), marginTop: 18 }, focusedInput === 'phone' && s.inputFocused]}>
            <Text style={[s.prefix, { color: textMain, borderRightColor: border }]}>🇮🇳 +91</Text>
            <TextInput
              ref={phoneInputRef}
              style={[s.inputText, { color: textMain }]}
              placeholder="10-digit mobile number"
              placeholderTextColor={textSub}
              keyboardType="number-pad"
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
              <TouchableOpacity onPress={() => setPhone('')}>
                <X size={16} color={textSub} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[s.ctaBtn, { opacity: (phone.length === 10 && !loading) ? 1 : 0.55, marginTop: 20 }]}
            onPress={() => handleCheckNumber()}
            disabled={phone.length !== 10 || loading}
            activeOpacity={0.88}
          >
            <LinearGradient colors={['#6334E8', '#7C47FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.ctaGrad}>
              {loading ? <ActivityIndicator size="small" color="#FFF" /> : (
                <><Text style={s.ctaText}>Continue</Text><ArrowRight size={18} color="#FFF" style={{ marginLeft: 8 }} /></>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={{ alignItems: 'center', marginTop: 16 }} onPress={() => navigation.navigate('RoleSelection', { prefillPhone: phone })}>
            <Text style={[s.footerText, { color: textSub }]}>New to Kwickly? <Text style={s.footerLink}>Create Account</Text></Text>
          </TouchableOpacity>

          {!keyboardVisible && (
            <View style={s.trustRow}>
              <ShieldCheck size={13} color="#10B981" />
              <Text style={[s.trustText, { color: textSub }]}> 100% Encrypted</Text>
              <Text style={[s.trustText, { color: textSub }]}> · </Text>
              <Zap size={13} color="#7C47FF" />
              <Text style={[s.trustText, { color: textSub }]}> Instant MPIN Access</Text>
              <Text style={[s.trustText, { color: textSub }]}> · 🇮🇳 India</Text>
            </View>
          )}
        </View>

        <CustomAlert visible={alertConfig.visible} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onConfirm={() => { const cb = alertConfig.onConfirm; setAlertConfig(p => ({ ...p, visible: false, onConfirm: null })); if (cb) cb(); }} />
      </View>
    );
  }

  // ─── STEP: SELECT_ROLE ───
  if (step === 'SELECT_ROLE') {
    return (
      <View style={[s.root, { backgroundColor: bg }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <LinearGradient colors={['#5B2FD4', '#7C47FF', '#9B6BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: topPad + 28 }]}>
          <Text style={s.heroTitle}>Select Profile</Text>
          <Text style={s.heroSub}>Multiple accounts found for +91 {phone}</Text>
        </LinearGradient>
        <View style={[s.formArea, { backgroundColor: cardBg, paddingBottom: bottomPad + 16 }]}>
          {availableAccounts.map((acc, idx) => {
            const meta = ROLE_META[acc.role] || ROLE_META.CUSTOMER;
            const Icon = meta.icon;
            return (
              <TouchableOpacity key={idx} style={[s.accountCard, { backgroundColor: inputBg, borderColor: border }]} onPress={() => handleSelectAccount(acc)} activeOpacity={0.75}>
                <View style={[s.accountIconBox, { backgroundColor: meta.bg }]}><Icon size={22} color={meta.color} /></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.accountRole, { color: textMain }]}>{meta.label}</Text>
                  <Text style={[s.accountName, { color: textSub }]}>{acc.name || 'Registered Profile'}</Text>
                </View>
                <ArrowRight size={16} color={textSub} />
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={{ alignItems: 'center', marginTop: 20, paddingVertical: 10 }} onPress={() => setStep('PHONE')}>
            <Text style={s.footerLink}>Use a different mobile number</Text>
          </TouchableOpacity>
        </View>
        <CustomAlert visible={alertConfig.visible} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onConfirm={() => { const cb = alertConfig.onConfirm; setAlertConfig(p => ({ ...p, visible: false, onConfirm: null })); if (cb) cb(); }} />
      </View>
    );
  }

  // ─── STEP: MPIN ───
  if (step === 'MPIN') {
    return (
      <View style={[s.root, { backgroundColor: bg }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <LinearGradient colors={['#5B2FD4', '#7C47FF', '#9B6BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: topPad + 28 }]}>
          <Text style={s.heroTitle}>Welcome Back{detectedName ? `, ${detectedName}!` : '!'}</Text>
          <Text style={s.heroSub}>Enter your 4-digit MPIN to access your account</Text>
          <View style={[s.rolePill, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
            <RoleIcon size={13} color="#FFF" />
            <Text style={s.rolePillText}>{currentRoleMeta.label}</Text>
            <Text style={s.rolePillSep}>•</Text>
            <Text style={s.rolePillText}>+91 {phone}</Text>
            <TouchableOpacity onPress={() => setStep('PHONE')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Edit3 size={11} color="rgba(255,255,255,0.8)" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={[s.formArea, { backgroundColor: cardBg, paddingBottom: bottomPad + 12 }]}>
          {/* Hidden input */}
          <TextInput
            ref={mpinInputRef}
            style={s.hiddenInput}
            keyboardType="number-pad"
            maxLength={4}
            value={mpin}
            onChangeText={handleMpinChange}
            onFocus={() => setFocusedInput('mpin')}
            onBlur={() => setFocusedInput(null)}
            caretHidden={true}
          />

          {/* PIN Boxes */}
          <Text style={[s.sectionSub, { color: textSub, textAlign: 'center', marginBottom: 20 }]}>Tap boxes to type your MPIN</Text>
          <Animated.View style={[s.pinRow, { transform: [{ translateX: shakeAnim }] }]}>
            {[0, 1, 2, 3].map((i) => {
              const filled = mpin.length > i;
              const current = mpin.length === i && focusedInput === 'mpin';
              return (
                <Pressable
                  key={i}
                  onPress={() => mpinInputRef.current?.focus()}
                  style={[
                    s.pinBox,
                    { backgroundColor: inputBg, borderColor: border },
                    current && { borderColor: '#7C47FF', backgroundColor: isDarkMode ? 'rgba(124,71,255,0.12)' : '#F0EEFF' },
                    filled && { borderColor: '#7C47FF', backgroundColor: isDarkMode ? '#1E1B4B' : '#FAF5FF' },
                    mpinError && { borderColor: '#EF4444', backgroundColor: isDarkMode ? 'rgba(239,68,68,0.08)' : '#FEF2F2' },
                  ]}
                >
                  {filled ? (
                    showMpin ? (
                      <Text style={[s.pinDigit, { color: textMain }]}>{mpin[i]}</Text>
                    ) : (
                      <View style={s.pinDot} />
                    )
                  ) : (
                    <View style={[s.pinEmptyDot, { backgroundColor: isDarkMode ? '#2D3454' : '#CBD5E1' }]} />
                  )}
                </Pressable>
              );
            })}
          </Animated.View>

          {/* Controls */}
          <View style={s.pinControls}>
            <TouchableOpacity style={[s.eyePill, { backgroundColor: isDarkMode ? 'rgba(124,71,255,0.12)' : '#F0EEFF' }]} onPress={() => setShowMpin(!showMpin)}>
              {showMpin ? <EyeOff size={13} color="#7C47FF" /> : <Eye size={13} color="#7C47FF" />}
              <Text style={s.eyePillText}>{showMpin ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
            {loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#7C47FF" style={{ marginRight: 6 }} />
                <Text style={{ color: '#7C47FF', fontWeight: '700', fontSize: 12 }}>Verifying...</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={handleInitiateForgotMpin}>
                <Text style={s.footerLink}>Forgot MPIN?</Text>
              </TouchableOpacity>
            )}
          </View>

          {Boolean(mpinError) && (
            <View style={[s.errorBox, { backgroundColor: isDarkMode ? 'rgba(239,68,68,0.12)' : '#FEF2F2', borderColor: isDarkMode ? 'rgba(239,68,68,0.3)' : '#FCA5A5' }]}>
              <AlertCircle size={15} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={s.errorText}>{mpinError}</Text>
            </View>
          )}

          <TouchableOpacity style={[s.ctaBtn, { opacity: (mpin.length === 4 && !loading) ? 1 : 0.55, marginTop: 16 }]} onPress={() => handleMpinSubmit(mpin)} disabled={mpin.length !== 4 || loading} activeOpacity={0.88}>
            <LinearGradient colors={['#6334E8', '#7C47FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.ctaGrad}>
              {loading ? <ActivityIndicator size="small" color="#FFF" /> : (
                <><Text style={s.ctaText}>Sign In with MPIN</Text><ArrowRight size={18} color="#FFF" style={{ marginLeft: 8 }} /></>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, gap: 6 }} onPress={handleDirectOtpLogin}>
            <MessageSquare size={14} color="#7C47FF" />
            <Text style={[s.footerText, { color: textSub }]}>Sign in with <Text style={s.footerLink}>OTP instead</Text></Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ alignItems: 'center', marginTop: 6, paddingVertical: 4 }} onPress={() => { setMpin(''); setMpinError(''); setStep('PHONE'); }}>
            <Text style={s.footerLink}>Switch mobile number</Text>
          </TouchableOpacity>

          {!keyboardVisible && (
            <Text style={[s.secureBottom, { color: textSub }]}>Protected with bank-grade 256-bit encryption 🔒</Text>
          )}
        </View>

        <CustomAlert visible={alertConfig.visible} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onConfirm={() => { const cb = alertConfig.onConfirm; setAlertConfig(p => ({ ...p, visible: false, onConfirm: null })); if (cb) cb(); }} />
      </View>
    );
  }

  // ─── STEP: RESET_MPIN ───
  return (
    <KeyboardAvoidingView style={[s.root, { backgroundColor: bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#5B2FD4', '#7C47FF', '#9B6BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: topPad + 28 }]}>
        <Text style={s.heroTitle}>Reset MPIN</Text>
        <Text style={s.heroSub}>Enter the OTP sent to +91 {phone} and create a new MPIN</Text>
      </LinearGradient>
      <ScrollView style={{ flex: 1, backgroundColor: cardBg }} contentContainerStyle={{ padding: 20, paddingBottom: bottomPad + 20 }} keyboardShouldPersistTaps="handled">
        {/* OTP */}
        <Text style={[s.label, { color: textSub }]}>Verification OTP (4 Digits)</Text>
        <View style={[s.inputRow, { backgroundColor: inputBg, borderColor: focusedInput === 'resetOtp' ? '#7C47FF' : border, marginBottom: 14 }, focusedInput === 'resetOtp' && s.inputFocused]}>
          <MessageSquare size={16} color={focusedInput === 'resetOtp' ? '#7C47FF' : textSub} style={{ marginRight: 10 }} />
          <TextInput
            style={[s.inputText, { color: textMain, letterSpacing: resetOtp.length > 0 ? 8 : 0, fontWeight: '800' }]}
            placeholder="Enter 4-digit OTP"
            placeholderTextColor={textSub}
            keyboardType="number-pad"
            maxLength={4}
            value={resetOtp}
            onChangeText={(t) => setResetOtp(t.replace(/\D/g, '').slice(0, 4))}
            onFocus={() => setFocusedInput('resetOtp')}
            onBlur={() => setFocusedInput(null)}
          />
        </View>

        {/* New MPIN */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[s.label, { color: textSub }]}>New 4-Digit MPIN</Text>
          <TouchableOpacity onPress={() => setShowNewMpin(!showNewMpin)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {showNewMpin ? <EyeOff size={14} color="#7C47FF" /> : <Eye size={14} color="#7C47FF" />}
            <Text style={s.footerLink}>{showNewMpin ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>
        <View style={[s.inputRow, { backgroundColor: inputBg, borderColor: focusedInput === 'newMpin' ? '#7C47FF' : border, marginBottom: 14 }, focusedInput === 'newMpin' && s.inputFocused]}>
          <Lock size={16} color={focusedInput === 'newMpin' ? '#7C47FF' : textSub} style={{ marginRight: 10 }} />
          <TextInput
            style={[s.inputText, { color: textMain, letterSpacing: newMpin.length > 0 ? 8 : 0, fontWeight: '800' }]}
            placeholder="New 4-digit MPIN"
            placeholderTextColor={textSub}
            keyboardType="number-pad"
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
          <Text style={[s.label, { color: textSub }]}>Confirm New MPIN</Text>
          {isResetMatched && <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 12 }}>✓ Match</Text>}
          {isResetMismatched && <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 12 }}>✗ Mismatch</Text>}
        </View>
        <View style={[s.inputRow, { backgroundColor: inputBg, borderColor: focusedInput === 'confirmMpin' ? '#7C47FF' : (isResetMatched ? '#10B981' : border), marginBottom: 20 }, focusedInput === 'confirmMpin' && s.inputFocused]}>
          <ShieldCheck size={16} color={isResetMatched ? '#10B981' : (focusedInput === 'confirmMpin' ? '#7C47FF' : textSub)} style={{ marginRight: 10 }} />
          <TextInput
            style={[s.inputText, { color: textMain, letterSpacing: confirmNewMpin.length > 0 ? 8 : 0, fontWeight: '800' }]}
            placeholder="Re-enter MPIN"
            placeholderTextColor={textSub}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry={!showNewMpin}
            value={confirmNewMpin}
            onChangeText={(t) => setConfirmNewMpin(t.replace(/\D/g, '').slice(0, 4))}
            onFocus={() => setFocusedInput('confirmMpin')}
            onBlur={() => setFocusedInput(null)}
          />
        </View>

        <TouchableOpacity style={{ opacity: (resetOtp.length === 4 && isResetMatched && !loading) ? 1 : 0.55 }} onPress={handleExecuteResetMpin} disabled={resetOtp.length !== 4 || !isResetMatched || loading} activeOpacity={0.88}>
          <LinearGradient colors={['#6334E8', '#7C47FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.ctaGrad}>
            {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={s.ctaText}>Reset MPIN & Sign In</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={{ alignItems: 'center', marginTop: 14, paddingVertical: 6 }} onPress={() => setStep('MPIN')}>
          <Text style={s.footerLink}>Back to MPIN sign in</Text>
        </TouchableOpacity>
      </ScrollView>
      <CustomAlert visible={alertConfig.visible} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onConfirm={() => { const cb = alertConfig.onConfirm; setAlertConfig(p => ({ ...p, visible: false, onConfirm: null })); if (cb) cb(); }} />
    </KeyboardAvoidingView>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },
  hero: { paddingHorizontal: 20, paddingBottom: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  brandDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFD580', marginRight: 8 },
  brandName: { fontSize: 20, fontWeight: '900', color: '#FFF', letterSpacing: -0.3 },
  heroTitle: { fontSize: 28, fontWeight: '900', color: '#FFF', letterSpacing: -0.5, marginBottom: 4 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginBottom: 14 },
  trustPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 6 },
  trustPillText: { fontSize: 11.5, color: '#FFF', fontWeight: '600' },
  rolePill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 5 },
  rolePillText: { fontSize: 12, color: '#FFF', fontWeight: '700' },
  rolePillSep: { color: 'rgba(255,255,255,0.5)' },
  formArea: { flex: 1, paddingHorizontal: 20, paddingTop: 22, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -10 },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 13, marginTop: 2 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6, letterSpacing: 0.2 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5,
    borderRadius: 14, height: 50, paddingHorizontal: 12,
  },
  inputFocused: { shadowColor: '#7C47FF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 2 },
  inputText: { flex: 1, fontSize: 15, fontWeight: '600', padding: 0 },
  prefix: { fontSize: 14, fontWeight: '800', marginRight: 10, paddingRight: 10, borderRightWidth: 1 },
  hiddenInput: { position: 'absolute', opacity: 0.01, width: 1, height: 1 },
  /* PIN */
  pinRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 6 },
  pinBox: { width: 62, height: 64, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  pinDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#7C47FF' },
  pinEmptyDot: { width: 8, height: 8, borderRadius: 4 },
  pinDigit: { fontSize: 22, fontWeight: '900' },
  pinControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 },
  eyePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  eyePillText: { fontSize: 11.5, fontWeight: '700', color: '#7C47FF' },
  errorBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginBottom: 4 },
  errorText: { fontSize: 12.5, fontWeight: '700', color: '#EF4444', flex: 1 },
  /* Account cards */
  accountCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 14, padding: 14, marginBottom: 10 },
  accountIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  accountRole: { fontSize: 14, fontWeight: '800' },
  accountName: { fontSize: 12, marginTop: 2 },
  /* CTA */
  ctaBtn: { borderRadius: 16, shadowColor: '#7C47FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  ctaGrad: { height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 },
  /* Footer */
  footerText: { fontSize: 13 },
  footerLink: { color: '#7C47FF', fontWeight: '800', fontSize: 13 },
  trustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' },
  trustText: { fontSize: 11.5 },
  secureBottom: { fontSize: 11.5, textAlign: 'center', marginTop: 14 },
});

export default LoginScreen;
