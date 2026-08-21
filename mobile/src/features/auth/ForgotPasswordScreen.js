import React, { useState, useRef } from 'react';
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
  Modal
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomAlert from '../../components/ui/CustomAlert';
import { useTheme } from '../../context/ThemeContext';
import { Phone, Lock, ChevronLeft, Eye, EyeOff, CheckCircle2 } from 'lucide-react-native';
import api from '../../services/api';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';

const ForgotPasswordScreen = ({ navigation, route }) => {
  const { role = 'CUSTOMER', prefillPhone = '' } = route.params || {};
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [step, setStep] = useState('PHONE'); // 'PHONE' -> 'RESET'
  const [phone, setPhone] = useState(prefillPhone);
  const [code, setCode] = useState(['', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' });

  const inputs = useRef([]);

  const showAlert = (title, message, type = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const handleSendOtp = async () => {
    if (!phone || phone.length < 10) {
      showAlert('Validation Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/send-otp', { phone, role });
      setStep('RESET');
    } catch (error) {
      const errDetails = error.response?.data?.message || 'Failed to send OTP';
      showAlert('Error', errDetails);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const otpCode = code.join('');
    if (otpCode.length < 4) {
      showAlert('Incomplete Code', 'Please enter the 4-digit verification code.');
      return;
    }

    if (newPassword.length < 8) {
      showAlert('Weak Password', 'New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert('Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { 
        phone, 
        code: otpCode, 
        newPassword, 
        role 
      });
      setShowSuccessModal(true);
    } catch (error) {
      const errDetails = error.response?.data?.message || 'Failed to reset password';
      showAlert('Error', errDetails);
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
          <TouchableOpacity onPress={() => step === 'RESET' ? setStep('PHONE') : navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reset Password</Text>
          <View style={styles.headerRight}>
            <KwicklyIcon size={28} />
          </View>
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.body}>
            {step === 'PHONE' ? (
              <>
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>Forgot Password?</Text>
                  <Text style={styles.subtitle}>Enter your registered mobile number to receive a verification code.</Text>
                </View>

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

                <View style={styles.bottomSpacer} />

                <TouchableOpacity style={styles.btnShadow} onPress={handleSendOtp} disabled={loading} activeOpacity={0.88}>
                  <LinearGradient
                    colors={['#7C3AED', '#6C47FF']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.btnGradient}
                  >
                    <Text style={styles.btnText}>{loading ? 'Sending Code...' : 'Send Reset Code →'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>Enter Code & New Password</Text>
                  <Text style={styles.subtitle}>We sent a verification code to +91 {phone}</Text>
                </View>

                <Text style={styles.inputLabel}>4-Digit Code</Text>
                <View style={styles.otpContainer}>
                  {code.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => (inputs.current[index] = ref)}
                      style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                      maxLength={1}
                      keyboardType="number-pad"
                      value={digit}
                      onChangeText={(text) => {
                        const newCode = [...code];
                        newCode[index] = text;
                        setCode(newCode);
                        if (text && index < 3 && inputs.current[index + 1]) {
                          inputs.current[index + 1].focus();
                        }
                      }}
                    />
                  ))}
                </View>

                <Text style={styles.inputLabel}>New Password</Text>
                <View style={[styles.inputWrapper, focusedInput === 'newPassword' && styles.inputFocused]}>
                  <View style={styles.inputIcon}>
                    <Lock size={18} color={focusedInput === 'newPassword' ? '#6C47FF' : theme.colors.textDim} />
                  </View>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Minimum 8 characters"
                    placeholderTextColor={theme.colors.textDim}
                    secureTextEntry={!showPassword}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    onFocus={() => setFocusedInput('newPassword')}
                    onBlur={() => setFocusedInput(null)}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                    {showPassword ? <EyeOff size={18} color={theme.colors.textDim} /> : <Eye size={18} color={theme.colors.textDim} />}
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <View style={[styles.inputWrapper, focusedInput === 'confirmPassword' && styles.inputFocused]}>
                  <View style={styles.inputIcon}>
                    <Lock size={18} color={focusedInput === 'confirmPassword' ? '#6C47FF' : theme.colors.textDim} />
                  </View>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Re-enter new password"
                    placeholderTextColor={theme.colors.textDim}
                    secureTextEntry={!showPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onFocus={() => setFocusedInput('confirmPassword')}
                    onBlur={() => setFocusedInput(null)}
                  />
                </View>

                <View style={styles.bottomSpacer} />

                <TouchableOpacity style={styles.btnShadow} onPress={handleResetPassword} disabled={loading} activeOpacity={0.88}>
                  <LinearGradient
                    colors={['#7C3AED', '#6C47FF']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.btnGradient}
                  >
                    <Text style={styles.btnText}>{loading ? 'Updating Password...' : 'Reset Password →'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
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
            <Text style={styles.modalTitle}>Password Reset!</Text>
            <Text style={styles.modalDesc}>Your password has been successfully updated.</Text>
            
            <TouchableOpacity 
              style={[styles.btnShadow, { width: '100%', marginBottom: 0 }]} 
              onPress={() => {
                setShowSuccessModal(false);
                navigation.navigate('Login', { prefillPhone: phone, role });
              }}
            >
              <LinearGradient
                colors={['#7C3AED', '#6C47FF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.btnGradient}
              >
                <Text style={styles.btnText}>Sign In Now →</Text>
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
    marginBottom: 24,
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
    marginBottom: 16,
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
  },
  eyeBtn: {
    padding: 14,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
    width: '100%',
  },
  otpInput: {
    width: 62,
    height: 62,
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderRadius: 16,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '900',
    color: theme.colors.text,
  },
  otpInputFilled: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.1)' : '#F5F3FF',
    borderWidth: 2,
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

export default ForgotPasswordScreen;
