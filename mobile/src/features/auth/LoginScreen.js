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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Phone, Lock, ChevronLeft, ArrowRight, Eye, EyeOff } from 'lucide-react-native';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import CustomAlert from '../../components/ui/CustomAlert';
import LinearGradient from 'react-native-linear-gradient';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';

const LoginScreen = ({ navigation, route }) => {
  const { role: initialRole = 'CUSTOMER', prefillPhone = '' } = route.params || {};
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState(initialRole);
  const { signIn } = useAuth();
  const [loginMode, setLoginMode] = useState('OTP'); // 'OTP' or 'PASSWORD'
  const [phone, setPhone] = useState(prefillPhone);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' });

  const showAlert = (title, message, type = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const handleAction = async () => {
    if (!phone || phone.length < 10) {
      showAlert('Error', 'Please enter a valid 10-digit mobile number');
      return;
    }
    
    if (loginMode === 'PASSWORD' && (!password || password.length < 6)) {
      showAlert('Error', 'Please enter your password (min 6 characters)');
      return;
    }

    setLoading(true);
    try {
      if (loginMode === 'OTP') {
        await authService.sendOtp(phone, role);
        navigation.navigate('OTPVerify', { phone, role });
      } else {
        const response = await authService.login(phone, password, role);
        const { token, user } = response.data.data;
        await signIn(token, user.role);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.errors?.join(', ') || error.response?.data?.message || error.message || 'Something went wrong';
      showAlert('Error', errorMsg);
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
              <Text style={styles.subtitle}>Select your profile type to sign in</Text>
            </View>

            {/* Role Switcher */}
            <View style={styles.roleSwitcher}>
              {['CUSTOMER', 'WORKER', 'SHOP'].map(r => {
                const isActive = role === r;
                return (
                  <TouchableOpacity 
                    key={r}
                    onPress={() => setRole(r)}
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
                      {r === 'CUSTOMER' ? 'Customer' : r === 'WORKER' ? 'Worker' : 'Shop'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Login Mode Switcher */}
            <View style={styles.modeSwitcher}>
              <TouchableOpacity 
                onPress={() => setLoginMode('OTP')}
                style={[
                  styles.modeTab, 
                  loginMode === 'OTP' ? styles.modeTabActive : styles.modeTabInactive
                ]}
                activeOpacity={0.7}
              >
                <Text style={[styles.modeText, loginMode === 'OTP' ? styles.modeTextActive : styles.modeTextInactive]}>OTP Login</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => setLoginMode('PASSWORD')}
                style={[
                  styles.modeTab, 
                  loginMode === 'PASSWORD' ? styles.modeTabActive : styles.modeTabInactive
                ]}
                activeOpacity={0.7}
              >
                <Text style={[styles.modeText, loginMode === 'PASSWORD' ? styles.modeTextActive : styles.modeTextInactive]}>Password</Text>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <Text style={styles.inputLabel}>Mobile Number</Text>
              <View style={[styles.inputWrapper, focusedInput === 'phone' && styles.inputFocused]}>
                <View style={styles.inputIcon}>
                  <Phone size={18} color={focusedInput === 'phone' ? '#6C47FF' : theme.colors.textDim} />
                </View>
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

              {loginMode === 'PASSWORD' && (
                <>
                  <Text style={styles.inputLabel}>Password</Text>
                  <View style={[styles.inputWrapper, focusedInput === 'password' && styles.inputFocused]}>
                    <View style={styles.inputIcon}>
                      <Lock size={18} color={focusedInput === 'password' ? '#6C47FF' : theme.colors.textDim} />
                    </View>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter your password"
                      placeholderTextColor={theme.colors.textDim}
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedInput('password')}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                      {showPassword ? <EyeOff size={18} color={theme.colors.textDim} /> : <Eye size={18} color={theme.colors.textDim} />}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity 
                    style={styles.forgotPassword}
                    onPress={() => navigation.navigate('ForgotPassword', { role, prefillPhone: phone })}
                  >
                    <Text style={styles.forgotText}>Forgot Password?</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity 
                style={[styles.btnShadow, { marginTop: 24 }]} 
                onPress={handleAction} 
                activeOpacity={0.88} 
                disabled={loading}
              >
                <LinearGradient
                  colors={['#7C3AED', '#6C47FF']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.btnGradient}
                >
                  <Text style={styles.btnText}>{loading ? 'Please wait...' : 'Sign In'}</Text>
                  {!loading && <ArrowRight size={18} color="#fff" style={{ marginLeft: 8 }} />}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.footerLink} onPress={() => navigation.navigate('RoleSelection')}>
                <Text style={styles.footerText}>New to Kwickly? <Text style={styles.footerLinkText}>Create Account</Text></Text>
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
        onConfirm={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
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
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
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
    fontSize: 26,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  roleSwitcher: {
    flexDirection: 'row',
    backgroundColor: isDarkMode ? '#131B2E' : '#F1F4F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
  },
  roleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  roleTabActive: {
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.2)' : '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  roleTabInactive: {
    backgroundColor: 'transparent',
  },
  roleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  roleTextActive: {
    color: '#6C47FF',
    fontWeight: '800',
  },
  roleTextInactive: {
    color: theme.colors.textDim,
  },
  modeSwitcher: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  modeTabActive: {
    backgroundColor: '#6C47FF',
  },
  modeTabInactive: {
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderWidth: 1,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
  },
  modeText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  modeTextInactive: {
    color: theme.colors.textDim,
  },
  form: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
    marginLeft: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: 14,
    height: 52,
    marginBottom: 14,
  },
  inputFocused: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.06)' : '#FFFFFF',
  },
  inputIcon: {
    paddingLeft: 14,
    paddingRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '600',
    height: '100%',
    letterSpacing: 0.3,
  },
  eyeBtn: {
    padding: 14,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  forgotText: {
    color: '#6C47FF',
    fontWeight: '700',
    fontSize: 13,
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
    flexDirection: 'row',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  footerLink: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 10,
  },
  footerText: {
    fontSize: 13.5,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  footerLinkText: {
    color: '#6C47FF',
    fontWeight: '800',
  }
});

export default LoginScreen;
