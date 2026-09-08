import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Keyboard,
  Animated,
  Pressable,
  Image,
  Easing,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { 
  Lock, 
  ChevronLeft, 
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
  Sparkles,
  Zap,
} from 'lucide-react-native';
import { authService } from '../../services/authService';
import { getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import CustomAlert from '../../components/ui/CustomAlert';
import LinearGradient from 'react-native-linear-gradient';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';

const { width: SW, height: SH } = Dimensions.get('window');

const ROLE_META = {
  CUSTOMER: { label: 'Customer', icon: User, color: '#6C47FF', bg: 'rgba(108, 71, 255, 0.12)' },
  WORKER: { label: 'Worker / Pro', icon: Wrench, color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
  SHOP: { label: 'Shop Owner', icon: Store, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
};

const LoginScreen = ({ navigation, route }) => {
  const { role: initialRole = null, prefillPhone = '' } = route.params || {};
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  // Steps: 'PHONE' -> 'SELECT_ROLE' (if multi-account) -> 'MPIN' -> 'RESET_MPIN'
  const [step, setStep] = useState('PHONE');
  const [phone, setPhone] = useState(prefillPhone);
  const [selectedRole, setSelectedRole] = useState(initialRole || 'CUSTOMER');
  const [detectedName, setDetectedName] = useState('');
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [hasMpinSet, setHasMpinSet] = useState(true);

  // MPIN State
  const [mpin, setMpin] = useState('');
  const [showMpin, setShowMpin] = useState(false);
  const [mpinError, setMpinError] = useState('');

  // Reset MPIN via OTP State
  const [resetOtp, setResetOtp] = useState('');
  const [newMpin, setNewMpin] = useState('');
  const [confirmNewMpin, setConfirmNewMpin] = useState('');
  const [showNewMpin, setShowNewMpin] = useState(false);

  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

  // Keyboard avoidance state
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef(null);
  const phoneInputRef = useRef(null);
  const mpinInputRef = useRef(null);
  const isCheckingPhoneRef = useRef(false);

  // Ambient floating background orbs
  const bgOrb1 = useRef(new Animated.Value(0)).current;
  const bgOrb2 = useRef(new Animated.Value(0)).current;

  // Shake animation for MPIN failure
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start();
  };

  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, 
    title: '', 
    message: '', 
    type: 'error',
    onConfirm: null 
  });

  const showAlert = (title, message, type = 'error', onConfirm = null) => {
    setAlertConfig({ visible: true, title, message, type, onConfirm });
  };

  // Ambient background animation loop
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgOrb1, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bgOrb1, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(bgOrb2, { toValue: 1, duration: 5000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bgOrb2, { toValue: 0, duration: 5000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // If prefilled phone is 10 digits on mount, auto-check status
  useEffect(() => {
    if (prefillPhone && prefillPhone.length === 10) {
      handleCheckNumber(prefillPhone);
    }
  }, [prefillPhone]);

  // When step changes to MPIN, auto-focus the MPIN input
  useEffect(() => {
    if (step === 'MPIN') {
      setMpin('');
      setMpinError('');
      const timer = setTimeout(() => {
        mpinInputRef.current?.focus();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [step]);

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

  const scrollToInput = (yOffset = 180) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: yOffset, animated: true });
    }, 150);
  };

  /**
   * Step 1: Auto-detect Account, Role & MPIN status from Mobile Number
   */
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
        // Account does not exist -> offer registration
        showAlert(
          'Account Not Found',
          `No Kwickly profile found for +91 ${targetPhone}. Would you like to create a new account?`,
          'info',
          () => {
            navigation.navigate('RoleSelection', { prefillPhone: targetPhone });
          }
        );
        return;
      }

      const accounts = Array.isArray(data.accounts) && data.accounts.length > 0 
        ? data.accounts 
        : [{ role: data.role || 'CUSTOMER', name: data.name || 'User', hasMpin: data.hasMpin ?? true }];

      setAvailableAccounts(accounts);

      if (accounts.length > 1) {
        // Multiple profiles exist on this phone -> let user pick profile
        setStep('SELECT_ROLE');
      } else {
        // Single profile -> auto-proceed
        const singleAcc = accounts[0];
        setSelectedRole(singleAcc.role);
        setDetectedName(singleAcc.name);
        setHasMpinSet(singleAcc.hasMpin);

        if (singleAcc.hasMpin) {
          setStep('MPIN');
        } else {
          // MPIN not set yet -> Auto send OTP so user can verify & set MPIN
          handleAutoSendOtpForMpin(targetPhone, singleAcc.role);
        }
      }
    } catch (error) {
      const errorMsg = getApiErrorMessage(error, 'Could not verify mobile number. Please try again.');
      showAlert('Sign In Failed', errorMsg);
    } finally {
      setLoading(false);
      isCheckingPhoneRef.current = false;
    }
  };

  /**
   * Auto-advance on phone number input
   */
  const handlePhoneChange = (text) => {
    const clean = text.replace(/[^0-9]/g, '').slice(0, 10);
    setPhone(clean);
    if (mpinError) setMpinError('');

    // If reaches 10 valid digits, automatically advance to check user / MPIN
    if (clean.length === 10 && /^[6-9]\d{9}$/.test(clean)) {
      Keyboard.dismiss();
      handleCheckNumber(clean);
    }
  };

  /**
   * Helper when MPIN is not configured on existing account
   */
  const handleAutoSendOtpForMpin = (targetPhone, role) => {
    showAlert(
      'MPIN Not Configured',
      'An MPIN has not been set for this account. We will send an OTP so you can sign in and set your 4-digit MPIN.',
      'info',
      async () => {
        setLoading(true);
        try {
          await authService.sendOtp(targetPhone, role);
          navigation.navigate('OTPVerify', { phone: targetPhone, role });
        } catch (err) {
          const errMsg = getApiErrorMessage(err, 'Failed to send OTP. Please try again.');
          showAlert('OTP Error', errMsg);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  /**
   * Step 2: Handle Profile Selection when phone has multiple roles
   */
  const handleSelectAccount = (acc) => {
    setSelectedRole(acc.role);
    setDetectedName(acc.name);
    setHasMpinSet(acc.hasMpin);

    if (acc.hasMpin) {
      setStep('MPIN');
    } else {
      handleAutoSendOtpForMpin(phone, acc.role);
    }
  };

  /**
   * Step 3: Auto Sign In with 4-Digit MPIN
   * Triggered automatically upon filling the 4th digit (no button tap needed!)
   */
  const handleMpinSubmit = async (pinValue) => {
    const targetPin = pinValue || mpin;
    if (!targetPin || targetPin.length !== 4) {
      setMpinError('Please enter your 4-digit Security MPIN.');
      triggerShake();
      return;
    }

    setLoading(true);
    setMpinError('');

    try {
      const response = await authService.login(phone, targetPin, selectedRole);
      const { token, user } = response.data.data;
      await signIn(token, user.role, user);
    } catch (error) {
      const errorData = error.response?.data;
      const isMpinNotSet = errorData?.mpinNotSet || 
                           errorData?.message?.toLowerCase()?.includes('mpin is not set') ||
                           errorData?.message?.toLowerCase()?.includes('password is not set');

      if (isMpinNotSet) {
        handleAutoSendOtpForMpin(phone, selectedRole);
      } else {
        const errorMsg = errorData?.errors?.join(', ') || errorData?.message || error.message || 'Incorrect MPIN. Please try again.';
        setMpinError(errorMsg);
        triggerShake();
        // Clear MPIN automatically so user can re-enter immediately
        setMpin('');
        setTimeout(() => {
          mpinInputRef.current?.focus();
        }, 120);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle MPIN text change with instant auto-submit on 4 digits
   */
  const handleMpinChange = (text) => {
    const clean = text.replace(/[^0-9]/g, '').slice(0, 4);
    setMpin(clean);
    if (mpinError) setMpinError('');

    if (clean.length === 4) {
      handleMpinSubmit(clean);
    }
  };

  /**
   * Direct OTP Login bypass
   */
  const handleDirectOtpLogin = async () => {
    setLoading(true);
    try {
      await authService.sendOtp(phone, selectedRole);
      navigation.navigate('OTPVerify', { phone, role: selectedRole });
    } catch (error) {
      const errorMsg = getApiErrorMessage(error, 'Failed to send verification OTP. Please try again.');
      showAlert('OTP Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Forgot MPIN -> Send OTP & open Reset MPIN view
   */
  const handleInitiateForgotMpin = async () => {
    setLoading(true);
    try {
      await authService.forgotMpin(phone, selectedRole);
      setResetOtp('');
      setNewMpin('');
      setConfirmNewMpin('');
      setStep('RESET_MPIN');
    } catch (error) {
      const errorMsg = getApiErrorMessage(error, 'Failed to send reset code. Please try again.');
      showAlert('Reset MPIN Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Submit New MPIN with OTP
   */
  const handleExecuteResetMpin = async () => {
    const cleanOtp = (resetOtp || '').trim();
    if (!cleanOtp || cleanOtp.length !== 4) {
      showAlert('Invalid OTP', 'Please enter the 4-digit OTP code sent to your phone (Default: 1234).');
      return;
    }
    if (!newMpin || newMpin.length !== 4) {
      showAlert('Invalid MPIN', 'New MPIN must be exactly 4 numeric digits.');
      return;
    }
    if (newMpin !== confirmNewMpin) {
      showAlert('MPIN Mismatch', 'New MPIN and confirmation MPIN do not match.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetMpin(phone, cleanOtp, newMpin, selectedRole);
      // Automatically log the user in with the newly set MPIN
      const loginRes = await authService.login(phone, newMpin, selectedRole);
      const { token, user } = loginRes.data.data;
      showAlert('MPIN Updated', 'Your MPIN was successfully reset. Logging you in...', 'success', async () => {
        await signIn(token, user.role, user);
      });
    } catch (error) {
      const errorMsg = getApiErrorMessage(error, 'Failed to reset MPIN. Please verify the 4-digit OTP code and try again.');
      showAlert('Reset Failed', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const headerTopPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 8;
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 16) + 20;
  const dynamicBottomPad = bottomPad + (keyboardVisible ? keyboardHeight + 30 : 16);
  const styles = createStyles(theme, isDarkMode, headerTopPad, dynamicBottomPad);

  const currentRoleMeta = ROLE_META[selectedRole] || ROLE_META.CUSTOMER;
  const RoleIcon = currentRoleMeta.icon;

  const isResetMatched = newMpin.length === 4 && confirmNewMpin.length === 4 && newMpin === confirmNewMpin;
  const isResetMismatched = confirmNewMpin.length === 4 && newMpin.length === 4 && newMpin !== confirmNewMpin;

  // Background orb interpolations
  const orb1Y = bgOrb1.interpolate({ inputRange: [0, 1], outputRange: [0, -25] });
  const orb1X = bgOrb1.interpolate({ inputRange: [0, 1], outputRange: [0, 20] });
  const orb2Y = bgOrb2.interpolate({ inputRange: [0, 1], outputRange: [0, 30] });
  const orb2X = bgOrb2.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8F9FD' }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? '#0B0F19' : '#F8F9FD'}
        translucent={false}
      />

      {/* Ambient Animated Background Orbs */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ambientOrbTop,
          { transform: [{ translateY: orb1Y }, { translateX: orb1X }] },
        ]}
      >
        <LinearGradient
          colors={['#8B5CF6', '#6C47FF']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.ambientOrbBottom,
          { transform: [{ translateY: orb2Y }, { translateX: orb2X }] },
        ]}
      >
        <LinearGradient
          colors={['#3B82F6', '#6C47FF']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            onPress={() => {
              if (step === 'RESET_MPIN') {
                setStep('MPIN');
              } else if (step === 'MPIN' || step === 'SELECT_ROLE') {
                setStep('PHONE');
              } else {
                navigation.goBack();
              }
            }} 
            style={styles.backBtn} 
            activeOpacity={0.7}
          >
            <ChevronLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {step === 'RESET_MPIN' ? 'Reset MPIN' : (step === 'MPIN' ? 'Enter MPIN' : 'Sign In')}
          </Text>
          <View style={styles.headerRight}>
            <KwicklyIcon size={28} />
          </View>
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.body}>

            {/* ─── BRAND HERO BADGE & TITLE ─── */}
            <View style={styles.brandHeroBlock}>
              <View style={styles.brandLogoCircle}>
                <Image
                  source={require('../../assets/logo.png')}
                  style={styles.brandLogoImg}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.brandWordmark, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                Kwick<Text style={{ color: '#6C47FF' }}>ly</Text>
              </Text>
              <View style={[styles.heroPill, { backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#EDE9FE' }]}>
                <Sparkles size={13} color="#6C47FF" style={{ marginRight: 5 }} />
                <Text style={styles.heroPillText}>Every Service. Anytime. Near You.</Text>
              </View>
            </View>

            {/* ─── STEP 1: SMART PHONE NUMBER ENTRY ─── */}
            {step === 'PHONE' && (
              <View style={styles.stepContainer}>
                {/* Input Card */}
                <View style={styles.inputCard}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>Welcome Back!</Text>
                    <Text style={styles.cardSubtitle}>Enter your 10-digit mobile number to sign in</Text>
                  </View>

                  <Text style={styles.inputLabel}>Mobile Number</Text>
                  <View style={[
                    styles.inputWrapper, 
                    focusedInput === 'phone' && styles.inputFocused,
                    phone.length === 10 && styles.inputReady
                  ]}>
                    <View style={styles.countryCodeBadge}>
                      <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                    </View>
                    <TextInput
                      ref={phoneInputRef}
                      style={styles.phoneInput}
                      placeholder="Enter 10-digit number"
                      placeholderTextColor={theme.colors.textDim}
                      keyboardType="phone-pad"
                      maxLength={10}
                      autoFocus={true}
                      value={phone}
                      onChangeText={handlePhoneChange}
                      onFocus={() => setFocusedInput('phone')}
                      onBlur={() => setFocusedInput(null)}
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        if (phone.length === 10) handleCheckNumber(phone);
                      }}
                    />
                    {phone.length === 10 ? (
                      <View style={styles.checkPill}>
                        <CheckCircle2 size={18} color="#10B981" />
                      </View>
                    ) : phone.length > 0 ? (
                      <TouchableOpacity onPress={() => setPhone('')} style={styles.clearBtn}>
                        <X size={16} color={theme.colors.textDim} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={styles.helperRow}>
                    <Zap size={13} color="#6C47FF" style={{ marginRight: 5 }} />
                    <Text style={styles.helperText}>Auto-detects your account upon entering 10 digits.</Text>
                  </View>

                  {/* Continue Action Button inside card */}
                  <TouchableOpacity 
                    style={[styles.btnShadow, { opacity: (phone.length === 10 && !loading) ? 1 : 0.65, marginTop: 18 }]} 
                    onPress={() => handleCheckNumber()} 
                    activeOpacity={0.88} 
                    disabled={phone.length !== 10 || loading}
                  >
                    <LinearGradient
                      colors={['#7C3AED', '#6C47FF']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={styles.btnGradient}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Text style={styles.btnText}>Continue</Text>
                          <ArrowRight size={18} color="#fff" style={{ marginLeft: 8 }} />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Registration Prompt Link */}
                  <View style={styles.bottomLinkContainer}>
                    <TouchableOpacity 
                      style={styles.registerLink}
                      onPress={() => navigation.navigate('RoleSelection', { prefillPhone: phone })}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.registerPrompt, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        New to Kwickly?{' '}
                        <Text style={styles.registerHighlight}>Create Account</Text>
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ─── TRUST & SECURITY SECTION (Fills Blank Space Beautifully) ─── */}
                <View style={styles.trustSection}>
                  <View style={styles.trustGrid}>
                    <View style={[styles.trustCard, { backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF', borderColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
                      <View style={[styles.trustIconCircle, { backgroundColor: 'rgba(108, 71, 255, 0.12)' }]}>
                        <ShieldCheck size={18} color="#6C47FF" />
                      </View>
                      <Text style={[styles.trustCardTitle, { color: theme.colors.text }]}>100% Secure</Text>
                      <Text style={styles.trustCardDesc}>Encrypted sign-in</Text>
                    </View>

                    <View style={[styles.trustCard, { backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF', borderColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
                      <View style={[styles.trustIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                        <Zap size={18} color="#10B981" />
                      </View>
                      <Text style={[styles.trustCardTitle, { color: theme.colors.text }]}>Instant Access</Text>
                      <Text style={styles.trustCardDesc}>4-Digit MPIN login</Text>
                    </View>

                    <View style={[styles.trustCard, { backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF', borderColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
                      <View style={[styles.trustIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                        <Store size={18} color="#F59E0B" />
                      </View>
                      <Text style={[styles.trustCardTitle, { color: theme.colors.text }]}>All-in-One</Text>
                      <Text style={styles.trustCardDesc}>Services & Shops</Text>
                    </View>
                  </View>

                  <View style={styles.trustFooter}>
                    <Text style={[styles.trustFooterText, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
                      Fast • Reliable • Local • Made for India 🇮🇳
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* ─── STEP 2: PROFILE SELECTOR (Only if phone has multiple accounts) ─── */}
            {step === 'SELECT_ROLE' && (
              <View style={styles.stepContainer}>
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>Select Profile</Text>
                  <Text style={styles.subtitle}>Multiple accounts found for +91 {phone}. Choose one to sign in:</Text>
                </View>

                <View style={{ marginBottom: 16 }}>
                  {availableAccounts.map((acc, idx) => {
                    const meta = ROLE_META[acc.role] || ROLE_META.CUSTOMER;
                    const IconComp = meta.icon;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={styles.accountCard}
                        onPress={() => handleSelectAccount(acc)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.roleIconBox, { backgroundColor: meta.bg }]}>
                          <IconComp size={24} color={meta.color} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.accountRoleLabel}>{meta.label}</Text>
                          <Text style={styles.accountName}>{acc.name || 'Registered Profile'}</Text>
                        </View>
                        <ArrowRight size={18} color={theme.colors.textDim} />
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity 
                  style={styles.switchNumberBtn} 
                  onPress={() => setStep('PHONE')}
                >
                  <Edit3 size={15} color="#6C47FF" />
                  <Text style={styles.switchNumberText}>Use a different mobile number</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ─── STEP 3: MPIN ENTRY VIEW (Auto-submit on 4th digit) ─── */}
            {step === 'MPIN' && (
              <View style={styles.stepContainer}>
                {/* MPIN Input Card with 4 Distinct Cells & Shake Animation */}
                <View style={styles.inputCard}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>Welcome Back{detectedName ? `, ${detectedName}` : ''}!</Text>
                    <Text style={styles.cardSubtitle}>Enter your 4-digit Security MPIN to access your account</Text>
                  </View>

                  <View style={styles.roleBadgeRow}>
                    <View style={[styles.roleBadge, { backgroundColor: currentRoleMeta.bg }]}>
                      <RoleIcon size={14} color={currentRoleMeta.color} />
                      <Text style={[styles.roleBadgeText, { color: currentRoleMeta.color }]}>
                        {currentRoleMeta.label}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setStep('PHONE')} style={styles.changePhonePill}>
                      <Text style={styles.phonePillText}>+91 {phone}</Text>
                      <Edit3 size={12} color="#6C47FF" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.labelRow, { marginTop: 12 }]}>
                    <Text style={styles.inputLabel}>4-Digit Security MPIN</Text>
                    <TouchableOpacity onPress={handleInitiateForgotMpin} activeOpacity={0.7}>
                      <Text style={styles.forgotText}>Forgot MPIN?</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Hidden Real TextInput for robust keyboard handling */}
                  <TextInput
                    ref={mpinInputRef}
                    style={styles.hiddenInput}
                    keyboardType="number-pad"
                    maxLength={4}
                    value={mpin}
                    onChangeText={handleMpinChange}
                    onFocus={() => setFocusedInput('mpin')}
                    onBlur={() => setFocusedInput(null)}
                    caretHidden={true}
                  />

                  {/* 4 Sleek Visual PIN Boxes */}
                  <Animated.View style={[styles.pinBoxesRow, { transform: [{ translateX: shakeAnim }] }]}>
                    {[0, 1, 2, 3].map((index) => {
                      const isFilled = mpin.length > index;
                      const isCurrent = mpin.length === index && focusedInput === 'mpin';
                      const digit = mpin[index] || '';

                      return (
                        <Pressable
                          key={index}
                          onPress={() => mpinInputRef.current?.focus()}
                          style={[
                            styles.pinBox,
                            isCurrent && styles.pinBoxCurrent,
                            isFilled && styles.pinBoxFilled,
                            mpinError ? styles.pinBoxError : null,
                          ]}
                        >
                          {isFilled ? (
                            showMpin ? (
                              <Text style={styles.pinDigitText}>{digit}</Text>
                            ) : (
                              <View style={styles.pinDot} />
                            )
                          ) : (
                            <View style={styles.pinEmptyDot} />
                          )}
                        </Pressable>
                      );
                    })}
                  </Animated.View>

                  {/* Eye Toggle & Feedback Row */}
                  <View style={styles.pinControlRow}>
                    <TouchableOpacity 
                      onPress={() => setShowMpin(!showMpin)} 
                      style={styles.eyeTogglePill}
                      activeOpacity={0.7}
                    >
                      {showMpin ? <EyeOff size={14} color="#6C47FF" /> : <Eye size={14} color="#6C47FF" />}
                      <Text style={styles.eyeTogglePillText}>{showMpin ? 'Hide MPIN' : 'Show MPIN'}</Text>
                    </TouchableOpacity>

                    {loading && (
                      <View style={styles.autoVerifyingPill}>
                        <ActivityIndicator size="small" color="#6C47FF" style={{ marginRight: 6 }} />
                        <Text style={styles.autoVerifyingText}>Verifying MPIN...</Text>
                      </View>
                    )}
                  </View>

                  {/* Inline Error Display (Clear, High Contrast) */}
                  {Boolean(mpinError) && (
                    <View style={styles.inlineErrorBox}>
                      <AlertCircle size={16} color="#EF4444" style={{ marginRight: 6 }} />
                      <Text style={styles.inlineErrorText}>{mpinError}</Text>
                    </View>
                  )}

                  {/* Sign In Button */}
                  <TouchableOpacity 
                    style={[styles.btnShadow, { opacity: (mpin.length === 4 && !loading) ? 1 : 0.65, marginTop: 18 }]} 
                    onPress={() => handleMpinSubmit(mpin)} 
                    activeOpacity={0.88} 
                    disabled={mpin.length !== 4 || loading}
                  >
                    <LinearGradient
                      colors={['#7C3AED', '#6C47FF']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={styles.btnGradient}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Text style={styles.btnText}>Sign In with MPIN</Text>
                          <ArrowRight size={18} color="#fff" style={{ marginLeft: 8 }} />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Secondary Actions */}
                  <View style={styles.actionLinksRow}>
                    <TouchableOpacity 
                      style={styles.otpSwitchLink}
                      onPress={handleDirectOtpLogin}
                      activeOpacity={0.7}
                    >
                      <MessageSquare size={16} color="#6C47FF" style={{ marginRight: 6 }} />
                      <Text style={styles.otpSwitchText}>
                        Sign in with <Text style={{ color: '#6C47FF', fontWeight: '800' }}>OTP instead</Text>
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity 
                    style={styles.switchNumberBtn} 
                    onPress={() => {
                      setMpin('');
                      setMpinError('');
                      setStep('PHONE');
                    }}
                  >
                    <Text style={styles.switchNumberText}>Switch mobile number</Text>
                  </TouchableOpacity>
                </View>

                {/* Trust Footer */}
                <View style={styles.trustSection}>
                  <View style={styles.trustFooter}>
                    <Text style={[styles.trustFooterText, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
                      Protected with bank-grade 256-bit encryption 🔒
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* ─── STEP 4: RESET MPIN VIA OTP ─── */}
            {step === 'RESET_MPIN' && (
              <View style={styles.stepContainer}>
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>Reset Security MPIN</Text>
                  <Text style={styles.subtitle}>
                    Enter the 4-digit OTP sent to +91 {phone} and create your new 4-digit MPIN.
                  </Text>
                  <View style={styles.otpDevBadge}>
                    <ShieldCheck size={14} color="#10B981" />
                    <Text style={styles.otpDevBadgeText}>Default Testing OTP: <Text style={{ fontWeight: '900', color: '#10B981' }}>1234</Text></Text>
                  </View>
                </View>

                {/* Reset Form Card */}
                <View style={styles.inputCard}>
                  {/* OTP Code */}
                  <Text style={styles.inputLabel}>Verification OTP (4 Digits)</Text>
                  <View style={[styles.inputWrapper, focusedInput === 'resetOtp' && styles.inputFocused, { marginBottom: 14 }]}>
                    <View style={styles.inputIcon}>
                      <MessageSquare size={18} color={focusedInput === 'resetOtp' ? '#6C47FF' : theme.colors.textDim} />
                    </View>
                    <TextInput
                      style={[styles.textInput, { letterSpacing: resetOtp.length > 0 ? 8 : 0, fontWeight: '800' }]}
                      placeholder="Enter 4-digit OTP (e.g. 1234)"
                      placeholderTextColor={theme.colors.textDim}
                      keyboardType="number-pad"
                      maxLength={4}
                      value={resetOtp}
                      onChangeText={(text) => setResetOtp(text.replace(/[^0-9]/g, '').slice(0, 4))}
                      onFocus={() => {
                        setFocusedInput('resetOtp');
                        scrollToInput(40);
                      }}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>

                  {/* New MPIN */}
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>New 4-Digit MPIN</Text>
                    <TouchableOpacity onPress={() => setShowNewMpin(!showNewMpin)} style={styles.eyeToggleBtn}>
                      {showNewMpin ? <EyeOff size={15} color="#6C47FF" /> : <Eye size={15} color="#6C47FF" />}
                      <Text style={styles.eyeToggleText}>{showNewMpin ? 'Hide' : 'Show'}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.inputWrapper, focusedInput === 'newMpin' && styles.inputFocused, { marginBottom: 14 }]}>
                    <View style={styles.inputIcon}>
                      <Lock size={18} color={focusedInput === 'newMpin' ? '#6C47FF' : theme.colors.textDim} />
                    </View>
                    <TextInput
                      style={[styles.textInput, { letterSpacing: newMpin.length > 0 ? (showNewMpin ? 4 : 8) : 0, fontWeight: '800' }]}
                      placeholder="Enter new 4-digit MPIN"
                      placeholderTextColor={theme.colors.textDim}
                      keyboardType="number-pad"
                      maxLength={4}
                      secureTextEntry={!showNewMpin}
                      value={newMpin}
                      onChangeText={(text) => setNewMpin(text.replace(/[^0-9]/g, '').slice(0, 4))}
                      onFocus={() => {
                        setFocusedInput('newMpin');
                        scrollToInput(120);
                      }}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>

                  {/* Confirm New MPIN */}
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>Confirm New MPIN</Text>
                    {isResetMatched && (
                      <View style={styles.matchBadgeSuccess}>
                        <Check size={12} color="#10B981" />
                        <Text style={styles.matchTextSuccess}>MPINs Match</Text>
                      </View>
                    )}
                    {isResetMismatched && (
                      <View style={styles.matchBadgeError}>
                        <X size={12} color="#EF4444" />
                        <Text style={styles.matchTextError}>Do not match</Text>
                      </View>
                    )}
                  </View>
                  <View style={[
                    styles.inputWrapper, 
                    focusedInput === 'confirmNewMpin' && styles.inputFocused,
                    isResetMatched && styles.inputSuccess
                  ]}>
                    <View style={styles.inputIcon}>
                      <ShieldCheck size={18} color={isResetMatched ? '#10B981' : focusedInput === 'confirmNewMpin' ? '#6C47FF' : theme.colors.textDim} />
                    </View>
                    <TextInput
                      style={[styles.textInput, { letterSpacing: confirmNewMpin.length > 0 ? (showNewMpin ? 4 : 8) : 0, fontWeight: '800' }]}
                      placeholder="Re-enter 4-digit MPIN"
                      placeholderTextColor={theme.colors.textDim}
                      keyboardType="number-pad"
                      maxLength={4}
                      secureTextEntry={!showNewMpin}
                      value={confirmNewMpin}
                      onChangeText={(text) => setConfirmNewMpin(text.replace(/[^0-9]/g, '').slice(0, 4))}
                      onFocus={() => {
                        setFocusedInput('confirmNewMpin');
                        scrollToInput(200);
                      }}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>

                  {/* Reset & Sign In Button */}
                  <TouchableOpacity 
                    style={[styles.btnShadow, { opacity: (resetOtp.length === 4 && isResetMatched && !loading) ? 1 : 0.65, marginTop: 18 }]} 
                    onPress={handleExecuteResetMpin} 
                    activeOpacity={0.88} 
                    disabled={resetOtp.length !== 4 || !isResetMatched || loading}
                  >
                    <LinearGradient
                      colors={['#7C3AED', '#6C47FF']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={styles.btnGradient}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.btnText}>Reset MPIN & Sign In →</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.switchNumberBtn} 
                    onPress={() => setStep('MPIN')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.switchNumberText}>Back to MPIN sign in</Text>
                  </TouchableOpacity>
                </View>
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
        onConfirm={() => {
          const cb = alertConfig.onConfirm;
          setAlertConfig(prev => ({ ...prev, visible: false, onConfirm: null }));
          if (cb) cb();
        }}
      />
    </View>
  );
};

const createStyles = (theme, isDarkMode, headerTopPad, bottomPad = 32) => StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  ambientOrbTop: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: isDarkMode ? 0.18 : 0.12,
  },
  ambientOrbBottom: {
    position: 'absolute',
    bottom: SH * 0.15,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: isDarkMode ? 0.16 : 0.1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: headerTopPad,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#1E293B' : '#EDF2F7',
    zIndex: 3,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
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
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: bottomPad,
  },
  body: {
    padding: 20,
    width: '100%',
    zIndex: 2,
  },
  brandHeroBlock: {
    alignItems: 'center',
    marginVertical: 12,
  },
  brandLogoCircle: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    marginBottom: 10,
  },
  brandLogoImg: {
    width: 52,
    height: 52,
  },
  brandWordmark: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 6,
  },
  heroPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6C47FF',
  },
  stepContainer: {
    width: '100%',
    marginTop: 4,
  },
  inputCard: {
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderWidth: 1,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeaderRow: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 13,
    color: theme.colors.textDim,
    fontWeight: '500',
    marginTop: 3,
    lineHeight: 18,
  },
  titleContainer: {
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textDim,
    fontWeight: '500',
    lineHeight: 20,
  },
  roleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  changePhonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
  },
  phonePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6C47FF',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 56,
  },
  inputFocused: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.06)' : '#FFFFFF',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  inputReady: {
    borderColor: '#10B981',
  },
  countryCodeBadge: {
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: isDarkMode ? '#334155' : '#CBD5E1',
    marginRight: 10,
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    padding: 0,
    letterSpacing: 0.5,
  },
  checkPill: {
    padding: 4,
  },
  clearBtn: {
    padding: 6,
  },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  helperText: {
    fontSize: 12,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0.01,
    width: 1,
    height: 1,
  },
  pinBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
    gap: 12,
  },
  pinBox: {
    flex: 1,
    height: 60,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBoxCurrent: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.08)' : '#F5F3FF',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  pinBoxFilled: {
    borderColor: '#8B5CF6',
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
  },
  pinBoxError: {
    borderColor: '#EF4444',
    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2',
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#6C47FF',
  },
  pinEmptyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: isDarkMode ? '#334155' : '#CBD5E1',
  },
  pinDigitText: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.text,
  },
  pinControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  eyeTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.12)' : '#F5F3FF',
  },
  eyeTogglePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6C47FF',
  },
  autoVerifyingPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  autoVerifyingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6C47FF',
  },
  inlineErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : '#FCA5A5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 14,
  },
  inlineErrorText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#EF4444',
    flex: 1,
  },
  btnShadow: {
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    borderRadius: 16,
  },
  btnGradient: {
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  bottomLinkContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  registerLink: {
    paddingVertical: 6,
  },
  registerPrompt: {
    fontSize: 14,
    fontWeight: '500',
  },
  registerHighlight: {
    color: '#6C47FF',
    fontWeight: '800',
  },
  trustSection: {
    marginTop: 10,
    width: '100%',
  },
  trustGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  trustCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  trustIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  trustCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  trustCardDesc: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
  trustFooter: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 6,
  },
  trustFooterText: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  actionLinksRow: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  otpSwitchLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  otpSwitchText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textDim,
  },
  switchNumberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  switchNumberText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#6C47FF',
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  roleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountRoleLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  accountName: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.textDim,
    marginTop: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    padding: 0,
  },
  otpDevBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 10,
    alignSelf: 'flex-start',
    gap: 6,
  },
  otpDevBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: isDarkMode ? '#34D399' : '#065F46',
  },
  eyeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#F0EDFF',
  },
  eyeToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6C47FF',
  },
  matchBadgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
  },
  matchTextSuccess: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#10B981',
  },
  matchBadgeError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
  },
  matchTextError: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#EF4444',
  },
  inputSuccess: {
    borderColor: '#10B981',
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.05)' : '#F0FDF4',
  },
});

export default LoginScreen;
