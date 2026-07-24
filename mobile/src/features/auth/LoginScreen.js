import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
  TextInput,
  Image
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Phone, Lock, ChevronLeft, ArrowRight, Eye, EyeOff } from 'lucide-react-native';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import CustomAlert from '../../components/ui/CustomAlert';
import LinearGradient from 'react-native-linear-gradient';

const LoginScreen = ({ navigation, route }) => {
  const { role: initialRole = 'CUSTOMER', prefillPhone = '' } = route.params || {};
  const { theme, isDarkMode } = useTheme();
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
      showAlert('Error', 'Please enter a valid password (min 6 characters)');
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

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={22} color={isDarkMode ? '#fff' : '#111'} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sign In</Text>
          <View style={styles.headerRight}>
            <Image source={require('../../assets/images/logo.jpeg')} style={styles.headerLogo} />
          </View>
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.body}>
            
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Welcome Back!</Text>
              <Text style={styles.subtitle}>Select your profile type to continue</Text>
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
              >
                <Text style={[styles.modeText, loginMode === 'OTP' ? styles.modeTextActive : styles.modeTextInactive]}>OTP Login</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => setLoginMode('PASSWORD')}
                style={[
                  styles.modeTab, 
                  loginMode === 'PASSWORD' ? styles.modeTabActive : styles.modeTabInactive
                ]}
              >
                <Text style={[styles.modeText, loginMode === 'PASSWORD' ? styles.modeTextActive : styles.modeTextInactive]}>Password</Text>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <Text style={styles.inputLabel}>Mobile Number</Text>
              <View style={[styles.inputWrapper, focusedInput === 'phone' && styles.inputFocused]}>
                <View style={styles.inputIcon}>
                  <Phone size={20} color={focusedInput === 'phone' ? '#6C47FF' : theme.colors.textDim} />
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="10-digit number"
                  placeholderTextColor={isDarkMode ? '#666' : '#999'}
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
                      <Lock size={20} color={focusedInput === 'password' ? '#6C47FF' : theme.colors.textDim} />
                    </View>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter your password"
                      placeholderTextColor={isDarkMode ? '#666' : '#999'}
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedInput('password')}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                      {showPassword ? <EyeOff size={20} color={theme.colors.textDim} /> : <Eye size={20} color={theme.colors.textDim} />}
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
                style={[styles.btnShadow, { marginTop: 32 }]} 
                onPress={handleAction} 
                activeOpacity={0.8} 
                disabled={loading}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#6C47FF']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.btnGradient}
                >
                  <Text style={styles.btnText}>{loading ? 'Please wait...' : 'Sign In'}</Text>
                  {!loading && <ArrowRight size={20} color="#fff" style={{ marginLeft: 8 }} />}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.footerLink} onPress={() => navigation.navigate('RoleSelection')}>
                <Text style={styles.footerText}>New to Kwickly? <Text style={styles.footerLinkText}>Sign Up</Text></Text>
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
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 16 : 16,
    paddingBottom: 4,
    backgroundColor: theme.colors.background,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#333' : '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  headerRight: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  headerLogo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius: 16,
  },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    padding: 24,
    flex: 1,
  },
  titleContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  roleSwitcher: {
    flexDirection: 'row',
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb',
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#333333' : '#e5e7eb',
  },
  roleTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  roleTabActive: {
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.08)' : '#f8f7ff',
    borderWidth: 1.5,
    borderColor: '#6C47FF',
  },
  roleTabInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  roleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  roleTextActive: {
    color: '#6C47FF',
  },
  roleTextInactive: {
    color: theme.colors.textDim,
  },
  modeSwitcher: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
  },
  modeTabActive: {
    backgroundColor: '#6C47FF',
    borderWidth: 1.5,
    borderColor: '#6C47FF',
  },
  modeTabInactive: {
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#333333' : '#e5e7eb',
  },
  modeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modeTextActive: {
    color: '#ffffff',
  },
  modeTextInactive: {
    color: theme.colors.textDim,
  },
  form: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#333333' : '#d1d5db',
    borderRadius: 18,
    height: 56,
    marginBottom: 16,
  },
  inputFocused: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.05)' : '#ffffff',
  },
  inputIcon: {
    paddingLeft: 16,
    paddingRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '600',
    height: '100%',
    letterSpacing: 0.5,
  },
  eyeBtn: {
    padding: 16,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotText: {
    color: '#6C47FF',
    fontWeight: '700',
    fontSize: 14,
  },
  bottomSpacer: {
    flex: 1,
    minHeight: 24,
  },
  btnShadow: {
    width: '100%',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  btnGradient: {
    flexDirection: 'row',
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.5,
  },
  footerLink: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 10,
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  footerLinkText: {
    color: '#6C47FF',
    fontWeight: '800',
  }
});

export default LoginScreen;
