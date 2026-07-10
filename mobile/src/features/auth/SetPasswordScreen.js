import React, { useState } from 'react';
import { 
  // Core components
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  TextInput,
  Modal,
  Image
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import CustomAlert from '../../components/ui/CustomAlert';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const SetPasswordScreen = ({ navigation, route }) => {
  const { phone, role, name = 'Your Name', token } = route.params || {};
  const { theme, isDarkMode } = useTheme();
  const { signIn } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [authPayload, setAuthPayload] = useState(null);
  const [focusedInput, setFocusedInput] = useState(null);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' });
  
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const getPasswordStrength = (pass) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/\d/.test(pass)) score += 1;
    if (/[@$!%*?&]/.test(pass)) score += 1;
    return score;
  };
  
  const strength = getPasswordStrength(password);
  const strengthLabels = ['Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['#e5e7eb', '#EF4444', '#F59E0B', '#10B981', '#059669'];

  const showAlert = (title, message, type = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  // Derived styling constants
  const roleLabels = { CUSTOMER: 'Customer', WORKER: 'Worker / Pro', SHOP: 'Shop Owner' };
  const roleIcons = { CUSTOMER: '👤', WORKER: '🛠', SHOP: '🏪' };
  
  const displayRole = roleLabels[role] || 'Customer';
  const displayIcon = roleIcons[role] || '👤';

  const handleSetPassword = async () => {
    setPasswordError('');
    setConfirmPasswordError('');
    
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    let isValid = true;
    
    if (!passwordRegex.test(password)) {
      setPasswordError('Must be 8+ chars with uppercase, lowercase, number, and special character');
      isValid = false;
    }
    
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    }
    
    if (!isValid) return;

    setLoading(true);
    try {
      await api.patch('/auth/set-password', { password }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Prepare auth payload for after modal dismisses
      const user = route.params?.user || { phone, role };
      setAuthPayload({ token, role: user.role || role });
      
      // Show custom success modal instead of Alert
      setShowSuccessModal(true);
      
    } catch (error) {
      const errDetails = error.response?.data?.errors?.join(', ') || error.response?.data?.message || 'Failed to set password';
      showAlert('Error', errDetails);
    } finally {
      setLoading(false);
    }
  };

  const handleContinueToApp = async () => {
    setShowSuccessModal(false);
    if (authPayload) {
      await signIn(authPayload.token, authPayload.role);
    }
  };

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      
      {/* Header matching prototype exactly */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft size={22} color={isDarkMode ? '#fff' : '#111'} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Set Password</Text>
          <View style={styles.headerRight}>
            <Image source={require('../../assets/images/logo.jpeg')} style={styles.headerLogo} />
          </View>
        </View>
        <View style={styles.stepDots}>
          <View style={[styles.stepDot, styles.stepDotDone]} />
          <View style={[styles.stepDot, styles.stepDotDone]} />
          <View style={[styles.stepDot, styles.stepDotDone]} />
          <View style={[styles.stepDot, styles.stepDotActive]} />
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.body}>
            
            {/* User Info Card */}
            <View style={styles.userCard}>
              <Text style={styles.userIcon}>{displayIcon}</Text>
              <View>
                <Text style={styles.userName}>{name}</Text>
                <Text style={styles.userDetails}>+91 {phone || '92743XXXXX'} · {displayRole}</Text>
              </View>
            </View>

            <Text style={styles.title}>Create your password</Text>
            <Text style={styles.subtitle}>Use this to login next time</Text>

            <Text style={styles.inputLabel}>New Password</Text>
            <View style={[styles.inputWrapper, passwordError ? styles.inputError : null, focusedInput === 'password' && styles.inputFocused, { marginBottom: password.length > 0 ? 12 : 16 }]}>
              <TextInput 
                style={styles.textInput}
                placeholder="Minimum 8 characters"
                placeholderTextColor={theme.colors.textDim}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setPasswordError('');
                }}
                onFocus={() => setFocusedInput('password')}
                onBlur={() => setFocusedInput(null)}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                {showPassword ? <EyeOff size={20} color={theme.colors.textDim} /> : <Eye size={20} color={theme.colors.textDim} />}
              </TouchableOpacity>
            </View>
            
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBars}>
                  {[1, 2, 3, 4].map(idx => (
                    <View 
                      key={idx} 
                      style={[
                        styles.strengthBar, 
                        { backgroundColor: strength >= idx ? strengthColors[strength] : (isDarkMode ? '#333' : '#e5e7eb') }
                      ]} 
                    />
                  ))}
                </View>
                <Text style={[styles.strengthText, { color: strengthColors[strength] }]}>
                  {strengthLabels[strength]}
                </Text>
              </View>
            )}

            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={[styles.inputWrapper, confirmPasswordError ? styles.inputError : null, focusedInput === 'confirm' && styles.inputFocused]}>
              <TextInput 
                style={styles.textInput}
                placeholder="Re-enter password"
                placeholderTextColor={theme.colors.textDim}
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPasswordError('');
                  setConfirmPassword(text);
                }}
                onFocus={() => setFocusedInput('confirm')}
                onBlur={() => setFocusedInput(null)}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                {showPassword ? <EyeOff size={20} color={theme.colors.textDim} /> : <Eye size={20} color={theme.colors.textDim} />}
              </TouchableOpacity>
            </View>
            {confirmPasswordError ? <Text style={styles.errorText}>{confirmPasswordError}</Text> : null}

            <View style={styles.tipsBox}>
              <Text style={styles.tipsTitle}>Password strength tips:</Text>
              <View style={styles.tipRow}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>At least 8 characters</Text>
              </View>
              <View style={styles.tipRow}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>1 Uppercase & 1 Lowercase letter</Text>
              </View>
              <View style={styles.tipRow}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>1 Number & 1 Special character (@$!%*?&)</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.btnShadow} onPress={handleSetPassword} disabled={loading} activeOpacity={0.8}>
              <LinearGradient
                colors={['#8B5CF6', '#6C47FF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.btnGradient}
              >
                <Text style={styles.btnText}>{loading ? 'Creating...' : 'Create My Account →'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.footerText}>
              By registering you agree to our <Text style={{color: theme.colors.primary, fontWeight: 'bold'}}>Terms & Privacy Policy</Text>
            </Text>
            
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.logoWrap}>
              <Image source={require('../../assets/images/logo.jpeg')} style={styles.logoImage} />
            </View>
            <Text style={styles.modalTitle}>Welcome to Kwickly!</Text>
            <Text style={styles.modalSubtitle}>Your account has been created successfully. You're all set.</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={handleContinueToApp}>
              <Text style={styles.btnText}>Let's Go 🎉</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 16 : 12,
    paddingBottom: 8,
    backgroundColor: theme.colors.background,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: isDarkMode ? '#333' : '#e5e7eb',
  },
  stepDotDone: {
    backgroundColor: isDarkMode ? '#888' : '#6b7280',
  },
  stepDotActive: {
    width: 28,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6C47FF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    padding: 16,
    paddingTop: 10,
  },
  userCard: {
    backgroundColor: theme.colors.primary + '10',
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  userIcon: {
    fontSize: 24,
  },
  userName: {
    fontWeight: '700',
    fontSize: 15,
    color: theme.colors.text,
  },
  userDetails: {
    fontSize: 13,
    color: theme.colors.textDim,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textDim,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textDim,
    marginBottom: 6,
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
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: isDarkMode ? '#2a1111' : '#fef2f2',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    marginTop: -10,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    color: theme.colors.text,
    height: '100%',
  },
  eyeBtn: {
    padding: 14,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
    gap: 12,
  },
  strengthBars: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '700',
    width: 45,
    textAlign: 'right',
  },
  tipsBox: {
    backgroundColor: theme.colors.surfaceMuted || '#f1f4f8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tipBullet: {
    color: theme.colors.textDim,
    fontSize: 12,
    marginRight: 6,
  },
  tipText: {
    fontSize: 11,
    color: theme.colors.textDim,
  },
  btnShadow: {
    width: '100%',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  btnGradient: {
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    color: theme.colors.textDim,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    width: '100%',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    resizeMode: 'cover',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 15,
    color: theme.colors.textDim,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  modalBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  }
});

export default SetPasswordScreen;
