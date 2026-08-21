import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomAlert from '../../components/ui/CustomAlert';
import { useTheme } from '../../context/ThemeContext';
import { ChevronLeft, Eye, EyeOff, CheckCircle2 } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';

const SetPasswordScreen = ({ navigation, route }) => {
  const { phone, role, name = 'Your Name', token } = route.params || {};
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
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

  const handleSetPassword = async () => {
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(
        '/auth/set-password', 
        { password },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const resData = response.data.data;
      setAuthPayload({ token: resData?.token || token, role });
      setShowSuccessModal(true);
    } catch (error) {
      const errDetails = error.response?.data?.errors?.join(', ') || error.response?.data?.message || 'Failed to set password';
      showAlert('Error', errDetails);
    } finally {
      setLoading(false);
    }
  };

  const handleModalContinue = async () => {
    setShowSuccessModal(false);
    if (authPayload) {
      await signIn(authPayload.token, authPayload.role);
    }
  };

  const headerTopPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 8;
  const styles = createStyles(theme, isDarkMode, headerTopPad);

  const displayRole = role === 'WORKER' ? 'Worker / Pro' : role === 'SHOP' ? 'Shop Owner' : 'Customer';

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
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ChevronLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Set Password</Text>
          <View style={styles.headerRight}>
            <KwicklyIcon size={28} />
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.body}>
            
            {/* User Info Card */}
            <View style={styles.userCard}>
              <View style={styles.userIconBg}>
                <Text style={{ fontSize: 20 }}>👤</Text>
              </View>
              <View>
                <Text style={styles.userName}>{name}</Text>
                <Text style={styles.userDetails}>+91 {phone} • {displayRole}</Text>
              </View>
            </View>

            <Text style={styles.title}>Create your password</Text>
            <Text style={styles.subtitle}>You'll use this password to sign in next time</Text>

            <Text style={styles.inputLabel}>New Password</Text>
            <View style={[styles.inputWrapper, passwordError ? styles.inputError : null, focusedInput === 'password' && styles.inputFocused]}>
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
                {showPassword ? <EyeOff size={18} color={theme.colors.textDim} /> : <Eye size={18} color={theme.colors.textDim} />}
              </TouchableOpacity>
            </View>
            
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBars}>
                  {[1, 2, 3, 4].map((index) => (
                    <View 
                      key={index} 
                      style={[
                        styles.strengthBar, 
                        { backgroundColor: index <= strength ? strengthColors[strength] : (isDarkMode ? '#334155' : '#E2E8F0') }
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
            <View style={[styles.inputWrapper, confirmPasswordError ? styles.inputError : null, focusedInput === 'confirmPassword' && styles.inputFocused]}>
              <TextInput 
                style={styles.textInput}
                placeholder="Re-enter your password"
                placeholderTextColor={theme.colors.textDim}
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setConfirmPasswordError('');
                }}
                onFocus={() => setFocusedInput('confirmPassword')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
            {confirmPasswordError ? <Text style={styles.errorText}>{confirmPasswordError}</Text> : null}

            <View style={styles.bottomSpacer} />

            <TouchableOpacity style={styles.btnShadow} onPress={handleSetPassword} disabled={loading} activeOpacity={0.88}>
              <LinearGradient
                colors={['#7C3AED', '#6C47FF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.btnGradient}
              >
                <Text style={styles.btnText}>{loading ? 'Creating Account...' : 'Complete Registration →'}</Text>
              </LinearGradient>
            </TouchableOpacity>

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

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.successModal}>
            <View style={styles.modalIconBox}>
              <CheckCircle2 size={44} color="#10B981" />
            </View>
            <Text style={styles.modalTitle}>Account Created!</Text>
            <Text style={styles.modalDesc}>Welcome to Kwickly. Your profile is ready.</Text>
            
            <TouchableOpacity style={[styles.btnShadow, { width: '100%', marginBottom: 0 }]} onPress={handleModalContinue}>
              <LinearGradient
                colors={['#7C3AED', '#6C47FF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.btnGradient}
              >
                <Text style={styles.btnText}>Let's Get Started →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
    marginBottom: 8,
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
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  stepDot: {
    width: 8,
    height: 6,
    borderRadius: 3,
    backgroundColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  stepDotDone: {
    width: 14,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  stepDotActive: {
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6C47FF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    padding: 20,
    flex: 1,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#131B2E' : '#F1F4F9',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    gap: 12,
  },
  userIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.2)' : '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  userDetails: {
    fontSize: 12.5,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textDim,
    marginBottom: 20,
    fontWeight: '500',
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
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  inputFocused: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.06)' : '#FFFFFF',
  },
  inputError: {
    borderColor: '#EF4444',
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
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
    marginRight: 12,
  },
  strengthBar: {
    height: 4,
    flex: 1,
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    marginLeft: 4,
  },
  bottomSpacer: {
    flex: 1,
    minHeight: 24,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModal: {
    width: '100%',
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 14,
    color: theme.colors.textDim,
    textAlign: 'center',
    marginBottom: 24,
  }
});

export default SetPasswordScreen;
