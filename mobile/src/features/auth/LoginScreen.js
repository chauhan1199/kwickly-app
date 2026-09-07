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
  X
} from 'lucide-react-native';
import { authService } from '../../services/authService';
import { getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import CustomAlert from '../../components/ui/CustomAlert';
import LinearGradient from 'react-native-linear-gradient';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';

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

  // If prefilled phone is 10 digits on mount, auto-check status
  useEffect(() => {
    if (prefillPhone && prefillPhone.length === 10) {
      handleCheckNumber(prefillPhone);
    }
  }, [prefillPhone]);

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
   * Step 3: Sign In with 4-Digit MPIN
   */
  const handleMpinLogin = async () => {
    if (!mpin || mpin.length !== 4) {
      showAlert('Invalid MPIN', 'Please enter your 4-digit Security MPIN.');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.login(phone, mpin, selectedRole);
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
        const errorMsg = errorData?.errors?.join(', ') || errorData?.message || error.message || 'Invalid MPIN. Please check and try again.';
        showAlert('Sign In Failed', errorMsg);
      }
    } finally {
      setLoading(false);
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
    if (!resetOtp || resetOtp.length < 4) {
      showAlert('Invalid OTP', 'Please enter the 6-digit OTP code sent to your phone.');
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
      await authService.resetMpin(phone, resetOtp, newMpin, selectedRole);
      // Automatically log the user in with the newly set MPIN
      const loginRes = await authService.login(phone, newMpin, selectedRole);
      const { token, user } = loginRes.data.data;
      showAlert('MPIN Updated', 'Your MPIN was successfully reset. Logging you in...', 'success', async () => {
        await signIn(token, user.role, user);
      });
    } catch (error) {
      const errorMsg = getApiErrorMessage(error, 'Failed to reset MPIN. Please verify the OTP and try again.');
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

            {/* ─── STEP 1: SMART PHONE NUMBER ENTRY ─── */}
            {step === 'PHONE' && (
              <View style={styles.stepContainer}>
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>Welcome Back!</Text>
                  <Text style={styles.subtitle}>Enter your 10-digit mobile number to sign in</Text>
                </View>

                {/* Input Card */}
                <View style={styles.inputCard}>
                  <Text style={styles.inputLabel}>Mobile Number</Text>
                  <View style={[styles.inputWrapper, focusedInput === 'phone' && styles.inputFocused]}>
                    <View style={styles.countryCodeBadge}>
                      <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                    </View>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="Enter 10-digit number"
                      placeholderTextColor={theme.colors.textDim}
                      keyboardType="phone-pad"
                      maxLength={10}
                      autoFocus={true}
                      value={phone}
                      onChangeText={(text) => {
                        const clean = text.replace(/[^0-9]/g, '');
                        setPhone(clean);
                      }}
                      onFocus={() => setFocusedInput('phone')}
                      onBlur={() => setFocusedInput(null)}
                    />
                    {phone.length > 0 && (
                      <TouchableOpacity onPress={() => setPhone('')} style={styles.clearBtn}>
                        <X size={16} color={theme.colors.textDim} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.helperText}>We will automatically detect your account & profile.</Text>
                </View>

                {/* Continue Action Button */}
                <TouchableOpacity 
                  style={[styles.btnShadow, { opacity: (phone.length === 10 && !loading) ? 1 : 0.6 }]} 
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

                {/* Bottom Registration Link */}
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

            {/* ─── STEP 3: MPIN ENTRY VIEW ─── */}
            {step === 'MPIN' && (
              <View style={styles.stepContainer}>
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>Welcome Back{detectedName ? `, ${detectedName}` : ''}!</Text>
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
                  <Text style={styles.subtitle}>Enter your 4-digit Security MPIN to access your account</Text>
                </View>

                {/* MPIN Input Box */}
                <View style={styles.inputCard}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>4-Digit Security MPIN</Text>
                    <TouchableOpacity onPress={handleInitiateForgotMpin} activeOpacity={0.7}>
                      <Text style={styles.forgotText}>Forgot MPIN?</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.inputWrapper, focusedInput === 'mpin' && styles.inputFocused]}>
                    <View style={styles.inputIcon}>
                      <Lock size={18} color={focusedInput === 'mpin' ? '#6C47FF' : theme.colors.textDim} />
                    </View>
                    <TextInput
                      style={[styles.textInput, { letterSpacing: showMpin ? 2 : 6, fontWeight: '800', fontSize: 20 }]}
                      placeholder="• • • •"
                      placeholderTextColor={theme.colors.textDim}
                      keyboardType="number-pad"
                      maxLength={4}
                      autoFocus={true}
                      secureTextEntry={!showMpin}
                      value={mpin}
                      onChangeText={(text) => {
                        const clean = text.replace(/[^0-9]/g, '').slice(0, 4);
                        setMpin(clean);
                      }}
                      onFocus={() => setFocusedInput('mpin')}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity onPress={() => setShowMpin(!showMpin)} style={styles.eyeBtn}>
                      {showMpin ? <EyeOff size={18} color={theme.colors.textDim} /> : <Eye size={18} color={theme.colors.textDim} />}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Sign In Button */}
                <TouchableOpacity 
                  style={[styles.btnShadow, { opacity: (mpin.length === 4 && !loading) ? 1 : 0.6 }]} 
                  onPress={handleMpinLogin} 
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
                    setStep('PHONE');
                  }}
                >
                  <Text style={styles.switchNumberText}>Switch mobile number</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ─── STEP 4: RESET MPIN VIA OTP ─── */}
            {step === 'RESET_MPIN' && (
              <View style={styles.stepContainer}>
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>Reset Security MPIN</Text>
                  <Text style={styles.subtitle}>
                    An OTP code has been sent to +91 {phone}. Enter it below to set your new 4-digit MPIN.
                  </Text>
                </View>

                {/* Reset Form Card */}
                <View style={styles.inputCard}>
                  {/* OTP Code */}
                  <Text style={styles.inputLabel}>Verification OTP</Text>
                  <View style={[styles.inputWrapper, focusedInput === 'resetOtp' && styles.inputFocused, { marginBottom: 14 }]}>
                    <View style={styles.inputIcon}>
                      <MessageSquare size={18} color={focusedInput === 'resetOtp' ? '#6C47FF' : theme.colors.textDim} />
                    </View>
                    <TextInput
                      style={[styles.textInput, { letterSpacing: 4, fontWeight: '700' }]}
                      placeholder="6-digit OTP"
                      placeholderTextColor={theme.colors.textDim}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={resetOtp}
                      onChangeText={(text) => setResetOtp(text.replace(/[^0-9]/g, ''))}
                      onFocus={() => {
                        setFocusedInput('resetOtp');
                        scrollToInput(60);
                      }}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>

                  {/* New MPIN */}
                  <Text style={styles.inputLabel}>New 4-Digit MPIN</Text>
                  <View style={[styles.inputWrapper, focusedInput === 'newMpin' && styles.inputFocused, { marginBottom: 14 }]}>
                    <View style={styles.inputIcon}>
                      <Lock size={18} color={focusedInput === 'newMpin' ? '#6C47FF' : theme.colors.textDim} />
                    </View>
                    <TextInput
                      style={[styles.textInput, { letterSpacing: showNewMpin ? 2 : 6, fontWeight: '800' }]}
                      placeholder="New MPIN"
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
                    <TouchableOpacity onPress={() => setShowNewMpin(!showNewMpin)} style={styles.eyeBtn}>
                      {showNewMpin ? <EyeOff size={18} color={theme.colors.textDim} /> : <Eye size={18} color={theme.colors.textDim} />}
                    </TouchableOpacity>
                  </View>

                  {/* Confirm New MPIN */}
                  <Text style={styles.inputLabel}>Confirm New MPIN</Text>
                  <View style={[styles.inputWrapper, focusedInput === 'confirmNewMpin' && styles.inputFocused]}>
                    <View style={styles.inputIcon}>
                      <ShieldCheck size={18} color={focusedInput === 'confirmNewMpin' ? '#6C47FF' : theme.colors.textDim} />
                    </View>
                    <TextInput
                      style={[styles.textInput, { letterSpacing: showNewMpin ? 2 : 6, fontWeight: '800' }]}
                      placeholder="Confirm New MPIN"
                      placeholderTextColor={theme.colors.textDim}
                      keyboardType="number-pad"
                      maxLength={4}
                      secureTextEntry={!showNewMpin}
                      value={confirmNewMpin}
                      onChangeText={(text) => setConfirmNewMpin(text.replace(/[^0-9]/g, '').slice(0, 4))}
                      onFocus={() => {
                        setFocusedInput('confirmNewMpin');
                        scrollToInput(220);
                      }}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                </View>

                {/* Reset & Sign In Button */}
                <TouchableOpacity 
                  style={[styles.btnShadow, { opacity: (resetOtp.length >= 4 && newMpin.length === 4 && confirmNewMpin.length === 4 && !loading) ? 1 : 0.6 }]} 
                  onPress={handleExecuteResetMpin} 
                  activeOpacity={0.88} 
                  disabled={resetOtp.length < 4 || newMpin.length !== 4 || confirmNewMpin.length !== 4 || loading}
                >
                  <LinearGradient
                    colors={['#7C3AED', '#6C47FF']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.btnGradient}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.btnText}>Reset MPIN & Sign In</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.switchNumberBtn} 
                  onPress={() => setStep('MPIN')}
                >
                  <Text style={styles.switchNumberText}>Back to MPIN sign in</Text>
                </TouchableOpacity>
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
  },
  stepContainer: {
    width: '100%',
  },
  titleContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
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
    marginVertical: 8,
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
  inputCard: {
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderWidth: 1,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
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
    marginBottom: 8,
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
    paddingHorizontal: 12,
    height: 54,
  },
  inputFocused: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.06)' : '#FFFFFF',
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
  clearBtn: {
    padding: 6,
  },
  helperText: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 8,
    fontWeight: '500',
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
  eyeBtn: {
    padding: 8,
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
  btnShadow: {
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
  actionLinksRow: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
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
  bottomLinkContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  registerLink: {
    paddingVertical: 8,
  },
  registerPrompt: {
    fontSize: 14,
    fontWeight: '500',
  },
  registerHighlight: {
    color: '#6C47FF',
    fontWeight: '800',
  },
});

export default LoginScreen;
