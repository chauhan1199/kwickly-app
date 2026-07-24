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
  Image,
  Modal
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Phone, Lock, ChevronLeft, ArrowRight, Hash, Eye, EyeOff } from 'lucide-react-native';
import api from '../../services/api';
import CustomAlert from '../../components/ui/CustomAlert';
import LinearGradient from 'react-native-linear-gradient';

const ForgotPasswordScreen = ({ navigation, route }) => {
  const { role = 'CUSTOMER', prefillPhone = '' } = route.params || {};
  const { theme, isDarkMode } = useTheme();
  
  const [step, setStep] = useState('PHONE'); // 'PHONE' | 'RESET'
  const [phone, setPhone] = useState(prefillPhone);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' });

  const showAlert = (title, message, type = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const handleSendOTP = async () => {
    if (!phone || phone.length < 10) {
      showAlert('Error', 'Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { phone, role });
      setStep('RESET');
    } catch (error) {
      const errDetails = error.response?.data?.message || 'Failed to send reset OTP';
      showAlert('Error', errDetails);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!code || code.length < 4) {
      showAlert('Error', 'Please enter the verification code');
      return;
    }
    if (newPassword.length < 6) {
      showAlert('Error', 'Password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { 
        phone, 
        code, 
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

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => step === 'RESET' ? setStep('PHONE') : navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={22} color={isDarkMode ? '#fff' : '#111'} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reset Password</Text>
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
            {step === 'PHONE' ? (
              <>
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>Forgot Password?</Text>
                  <Text style={styles.subtitle}>Enter your registered mobile number to receive a reset code.</Text>
                </View>

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
                  

                  <TouchableOpacity 
                    style={[styles.btnShadow, { marginTop: 32 }]} 
                    onPress={handleSendOTP} 
                    activeOpacity={0.8} 
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={['#8B5CF6', '#6C47FF']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={styles.btnGradient}
                    >
                      <Text style={styles.btnText}>{loading ? 'Please wait...' : 'Send Reset Code'}</Text>
                      {!loading && <ArrowRight size={20} color="#fff" style={{ marginLeft: 8 }} />}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>Create New Password</Text>
                  <Text style={styles.subtitle}>Enter the code sent to +91 {phone}</Text>
                </View>
                
                <View style={styles.form}>
                  <Text style={styles.inputLabel}>Verification Code</Text>
                  <View style={[styles.inputWrapper, focusedInput === 'code' && styles.inputFocused]}>
                    <View style={styles.inputIcon}>
                      <Hash size={20} color={focusedInput === 'code' ? '#6C47FF' : theme.colors.textDim} />
                    </View>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. 4729"
                      placeholderTextColor={isDarkMode ? '#666' : '#999'}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={code}
                      onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ''))}
                      onFocus={() => setFocusedInput('code')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                  
                  <Text style={styles.inputLabel}>New Password</Text>
                  <View style={[styles.inputWrapper, focusedInput === 'newPassword' && styles.inputFocused]}>
                    <View style={styles.inputIcon}>
                      <Lock size={20} color={focusedInput === 'newPassword' ? '#6C47FF' : theme.colors.textDim} />
                    </View>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Minimum 6 characters"
                      placeholderTextColor={isDarkMode ? '#666' : '#999'}
                      secureTextEntry={!showNewPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      onFocus={() => setFocusedInput('newPassword')}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeBtn}>
                      {showNewPassword ? <EyeOff size={20} color={theme.colors.textDim} /> : <Eye size={20} color={theme.colors.textDim} />}
                    </TouchableOpacity>
                  </View>
                  
                  <Text style={styles.inputLabel}>Confirm New Password</Text>
                  <View style={[styles.inputWrapper, focusedInput === 'confirmPassword' && styles.inputFocused]}>
                    <View style={styles.inputIcon}>
                      <Lock size={20} color={focusedInput === 'confirmPassword' ? '#6C47FF' : theme.colors.textDim} />
                    </View>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Re-enter password"
                      placeholderTextColor={isDarkMode ? '#666' : '#999'}
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      onFocus={() => setFocusedInput('confirmPassword')}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                      {showConfirmPassword ? <EyeOff size={20} color={theme.colors.textDim} /> : <Eye size={20} color={theme.colors.textDim} />}
                    </TouchableOpacity>
                  </View>
                  

                  <TouchableOpacity 
                    style={[styles.btnShadow, { marginTop: 32 }]} 
                    onPress={handleResetPassword} 
                    activeOpacity={0.8} 
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={['#8B5CF6', '#6C47FF']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={styles.btnGradient}
                    >
                      <Text style={styles.btnText}>{loading ? 'Updating...' : 'Update Password'}</Text>
                      {!loading && <ArrowRight size={20} color="#fff" style={{ marginLeft: 8 }} />}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
            <Text style={styles.modalTitle}>Password Reset!</Text>
            <Text style={styles.modalSubtitle}>Your password has been successfully updated. You can now login with your new password.</Text>
            
            <TouchableOpacity 
              style={styles.btnShadow} 
              onPress={() => {
                setShowSuccessModal(false);
                navigation.navigate('Login', { prefillPhone: phone, role });
              }} 
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#8B5CF6', '#6C47FF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.btnGradient}
              >
                <Text style={styles.btnText}>Go to Login</Text>
              </LinearGradient>
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
  form: {
    marginTop: 8,
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
    marginBottom: 20,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
    width: '100%',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 15,
  },
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    resizeMode: 'cover',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
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
});

export default ForgotPasswordScreen;
