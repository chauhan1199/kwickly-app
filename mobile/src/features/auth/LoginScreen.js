import React, { useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { 
  Phone, 
  Lock, 
  ChevronLeft, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  ShieldCheck,
  KeyRound,
  MessageSquare
} from 'lucide-react-native';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import CustomAlert from '../../components/ui/CustomAlert';
import LinearGradient from 'react-native-linear-gradient';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';

const LoginScreen = ({ navigation, route }) => {
  const { role: initialRole = 'CUSTOMER', prefillPhone = '', defaultMode = 'MPIN' } = route.params || {};
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState(initialRole);
  const { signIn } = useAuth();

  const [loginMode, setLoginMode] = useState(defaultMode); // 'MPIN' or 'OTP'
  const [phone, setPhone] = useState(prefillPhone);
  const [mpin, setMpin] = useState('');
  const [showMpin, setShowMpin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  
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

  const handleMpinLogin = async () => {
    if (!phone || phone.length !== 10) {
      showAlert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    
    if (!mpin || mpin.length !== 4) {
      showAlert('Invalid MPIN', 'Please enter your 4-digit Security MPIN.');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.login(phone, mpin, role);
      const { token, user } = response.data.data;
      await signIn(token, user.role, user);
    } catch (error) {
      const errorData = error.response?.data;
      const isMpinNotSet = errorData?.mpinNotSet || 
                           errorData?.message?.toLowerCase()?.includes('mpin is not set') ||
                           errorData?.message?.toLowerCase()?.includes('password is not set');

      if (isMpinNotSet) {
        // Automatically switch to OTP mode and send OTP to allow setting MPIN
        showAlert(
          'MPIN Not Set',
          'An MPIN is not configured for this account yet. We will send an OTP so you can verify and create your 4-digit MPIN.',
          'info',
          async () => {
            setLoading(true);
            try {
              await authService.sendOtp(phone, role);
              navigation.navigate('OTPVerify', { phone, role });
            } catch (otpErr) {
              const otpErrMsg = otpErr.response?.data?.message || 'Failed to send OTP. Please try again.';
              showAlert('OTP Error', otpErrMsg);
            } finally {
              setLoading(false);
            }
          }
        );
      } else {
        const errorMsg = errorData?.errors?.join(', ') || errorData?.message || error.message || 'Invalid MPIN or credentials. Please try again.';
        showAlert('Sign In Failed', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpLogin = async () => {
    if (!phone || phone.length !== 10) {
      showAlert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      await authService.sendOtp(phone, role);
      navigation.navigate('OTPVerify', { phone, role });
    } catch (error) {
      const errorMsg = error.response?.data?.errors?.join(', ') || error.response?.data?.message || 'Failed to send verification OTP. Please try again.';
      showAlert('OTP Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const headerTopPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 8;
  const styles = createStyles(theme, isDarkMode, headerTopPad);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
        translucent={false}
      />
      
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sign In</Text>
          <View style={styles.headerRight}>
            <KwicklyIcon size={28} />
          </View>
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.body}>
            
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Welcome Back!</Text>
              <Text style={styles.subtitle}>Select your profile type and sign in</Text>
            </View>

            {/* Role Switcher */}
            <View style={styles.roleSwitcher}>
              {[
                { key: 'CUSTOMER', label: 'Customer' },
                { key: 'WORKER', label: 'Worker / Pro' },
                { key: 'SHOP', label: 'Shop Owner' }
              ].map(r => {
                const isActive = role === r.key;
                return (
                  <TouchableOpacity 
                    key={r.key}
                    onPress={() => setRole(r.key)}
                    style={[
                      styles.roleTab, 
                      isActive ? styles.roleTabActive : styles.roleTabInactive
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.roleText, 
                      isActive ? styles.roleTextActive : styles.roleTextInactive
                    ]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Login Mode Switcher */}
            <View style={styles.modeSwitcher}>
              <TouchableOpacity 
                onPress={() => setLoginMode('MPIN')}
                style={[
                  styles.modeTab, 
                  loginMode === 'MPIN' ? styles.modeTabActive : styles.modeTabInactive
                ]}
                activeOpacity={0.7}
              >
                <KeyRound size={15} color={loginMode === 'MPIN' ? '#6C47FF' : theme.colors.textDim} style={{ marginRight: 6 }} />
                <Text style={[styles.modeText, loginMode === 'MPIN' ? styles.modeTextActive : styles.modeTextInactive]}>
                  MPIN Login
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => setLoginMode('OTP')}
                style={[
                  styles.modeTab, 
                  loginMode === 'OTP' ? styles.modeTabActive : styles.modeTabInactive
                ]}
                activeOpacity={0.7}
              >
                <MessageSquare size={15} color={loginMode === 'OTP' ? '#6C47FF' : theme.colors.textDim} style={{ marginRight: 6 }} />
                <Text style={[styles.modeText, loginMode === 'OTP' ? styles.modeTextActive : styles.modeTextInactive]}>
                  OTP Login
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <Text style={styles.inputLabel}>Mobile Number</Text>
              <View style={[styles.inputWrapper, focusedInput === 'phone' && styles.inputFocused]}>
                <View style={styles.inputIcon}>
                  <Phone size={18} color={focusedInput === 'phone' ? '#6C47FF' : theme.colors.textDim} />
                </View>
                <Text style={styles.prefixText}>+91</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter 10-digit number"
                  placeholderTextColor={theme.colors.textDim}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ''))}
                  onFocus={() => setFocusedInput('phone')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              {loginMode === 'MPIN' && (
                <>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>4-Digit Security MPIN</Text>
                    <TouchableOpacity 
                      onPress={() => navigation.navigate('ForgotPassword', { role, prefillPhone: phone })}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.forgotText}>Forgot MPIN?</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.inputWrapper, focusedInput === 'mpin' && styles.inputFocused]}>
                    <View style={styles.inputIcon}>
                      <Lock size={18} color={focusedInput === 'mpin' ? '#6C47FF' : theme.colors.textDim} />
                    </View>
                    <TextInput
                      style={[styles.textInput, { letterSpacing: showMpin ? 1 : 4, fontWeight: '700' }]}
                      placeholder="Enter 4-digit MPIN"
                      placeholderTextColor={theme.colors.textDim}
                      keyboardType="number-pad"
                      maxLength={4}
                      secureTextEntry={!showMpin}
                      value={mpin}
                      onChangeText={(text) => setMpin(text.replace(/[^0-9]/g, '').slice(0, 4))}
                      onFocus={() => setFocusedInput('mpin')}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity onPress={() => setShowMpin(!showMpin)} style={styles.eyeBtn}>
                      {showMpin ? <EyeOff size={18} color={theme.colors.textDim} /> : <Eye size={18} color={theme.colors.textDim} />}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity 
                    style={styles.otpSwitchLink}
                    onPress={() => setLoginMode('OTP')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.otpSwitchText}>
                      Don't have an MPIN? <Text style={{ color: '#6C47FF', fontWeight: '800' }}>Login with OTP</Text>
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Action Button */}
              <TouchableOpacity 
                style={[styles.btnShadow, { marginTop: loginMode === 'MPIN' ? 14 : 24 }]} 
                onPress={loginMode === 'MPIN' ? handleMpinLogin : handleOtpLogin} 
                activeOpacity={0.88} 
                disabled={loading}
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
                      <Text style={styles.btnText}>
                        {loginMode === 'MPIN' ? 'Sign In with MPIN' : 'Send Verification OTP'}
                      </Text>
                      <ArrowRight size={18} color="#fff" style={{ marginLeft: 8 }} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.registerLink}
                onPress={() => navigation.navigate('RoleSelection')}
                activeOpacity={0.7}
              >
                <Text style={[styles.registerPrompt, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  New to Kwickly?{' '}
                  <Text style={styles.registerHighlight}>Create Account</Text>
                </Text>
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
        onConfirm={() => {
          const cb = alertConfig.onConfirm;
          setAlertConfig(prev => ({ ...prev, visible: false, onConfirm: null }));
          if (cb) cb();
        }}
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
  },
  body: {
    padding: 20,
    flex: 1,
  },
  titleContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13.5,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  roleSwitcher: {
    flexDirection: 'row',
    backgroundColor: isDarkMode ? '#131B2E' : '#F1F4F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
  },
  roleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  roleTabActive: {
    backgroundColor: '#6C47FF',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  roleTabInactive: {
    backgroundColor: 'transparent',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  roleTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  roleTextInactive: {
    color: theme.colors.textDim,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    marginBottom: 22,
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  modeTabActive: {
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#F5F3FF',
    borderWidth: 1,
    borderColor: '#6C47FF',
  },
  modeTabInactive: {
    backgroundColor: 'transparent',
  },
  modeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modeTextActive: {
    color: '#6C47FF',
    fontWeight: '800',
  },
  modeTextInactive: {
    color: theme.colors.textDim,
  },
  form: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
    marginLeft: 2,
  },
  forgotText: {
    fontSize: 12,
    color: '#6C47FF',
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  inputFocused: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.06)' : '#FFFFFF',
  },
  inputIcon: {
    marginRight: 8,
  },
  prefixText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '600',
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
  },
  otpSwitchLink: {
    alignSelf: 'center',
    paddingVertical: 6,
    marginTop: 2,
  },
  otpSwitchText: {
    fontSize: 12,
    color: theme.colors.textDim,
    fontWeight: '500',
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
    paddingVertical: 15,
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
  registerLink: {
    alignSelf: 'center',
    paddingVertical: 6,
  },
  registerPrompt: {
    fontSize: 13,
    fontWeight: '600',
  },
  registerHighlight: {
    color: '#6C47FF',
    fontWeight: '800',
  },
});

export default LoginScreen;
