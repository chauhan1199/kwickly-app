import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  StatusBar,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import CustomAlert from '../../components/ui/CustomAlert';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { User, Wrench, CheckCircle2, Store, Info, ChevronLeft, Circle } from 'lucide-react-native';
import Button from '../../components/ui/Button';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const RoleSelection = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { signIn } = useAuth();
  
  // Steps: ROLE -> PHONE -> PASSWORD / OTP
  const [step, setStep] = useState('ROLE'); 
  const [selectedRole, setSelectedRole] = useState('CUSTOMER');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [otpMethod, setOtpMethod] = useState('SMS');
  const [focusedInput, setFocusedInput] = useState(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' });

  const showAlert = (title, message, type = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const validatePhone = (num) => /^[6-9]\d{9}$/.test(num);

  const handleRoleContinue = () => {
    setStep('PHONE');
  };

  const handlePhoneSubmit = async () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      showAlert('Validation Error', 'Please enter a valid full name (minimum 2 characters).');
      return;
    }
    if (!validatePhone(phoneNumber)) {
      showAlert('Validation Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/check-status', { phone: phoneNumber, role: selectedRole });
      const status = response.data.data;
      
      if (status.hasPassword) {
        // User exists and has a password, route them to Login screen with prefilled phone
        navigation.navigate('Login', { prefillPhone: phoneNumber, role: selectedRole });
      } else {
        // Send OTP via backend
        await api.post('/auth/send-otp', { phone: phoneNumber, role: selectedRole });
        
        // Navigate to OTP screen
        navigation.navigate('OTPVerify', { 
          phone: phoneNumber, 
          role: selectedRole, 
          otpMethod: otpMethod,
          fullName: fullName
        });
      }
    } catch (error) {
      const errMessage = error.response?.data?.message || 'Something went wrong';
      showAlert('Error', errMessage);
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(theme, isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      
      {/* Header matching prototype exactly */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => step === 'ROLE' ? navigation.goBack() : setStep('ROLE')}>
            <ChevronLeft size={22} color={isDarkMode ? '#fff' : '#111'} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Account</Text>
          <View style={styles.headerRight}>
            <Image source={require('../../assets/images/logo.jpeg')} style={styles.headerLogo} />
          </View>
        </View>
        <View style={styles.stepDots}>
          <View style={[styles.stepDot, step === 'ROLE' && styles.stepDotActive]} />
          <View style={[styles.stepDot, step === 'PHONE' && styles.stepDotActive]} />
          <View style={styles.stepDot} />
          <View style={styles.stepDot} />
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {step === 'ROLE' && (
            <View style={styles.body}>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>I want to join as...</Text>
                <Text style={styles.subtitle}>Choose your role to get started</Text>
              </View>

              {/* Role Cards */}
              <TouchableOpacity 
                style={[styles.roleCard, selectedRole === 'CUSTOMER' && styles.roleCardActive]}
                onPress={() => setSelectedRole('CUSTOMER')}
                activeOpacity={0.7}
              >
                <View style={[styles.roleIconBox, { backgroundColor: '#6C47FF15' }]}>
                  <User size={26} color="#6C47FF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleCardTitle}>Customer</Text>
                  <Text style={styles.roleCardDesc}>Book home services & shop nearby</Text>
                </View>
                <View style={[styles.roleCheck, selectedRole === 'CUSTOMER' && styles.roleCheckActive]}>
                  {selectedRole === 'CUSTOMER' && <CheckCircle2 size={16} color="#fff" />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.roleCard, selectedRole === 'WORKER' && styles.roleCardActive]}
                onPress={() => setSelectedRole('WORKER')}
                activeOpacity={0.7}
              >
                <View style={[styles.roleIconBox, { backgroundColor: '#6C47FF15' }]}>
                  <Wrench size={26} color="#6C47FF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleCardTitle}>Worker / Pro</Text>
                  <Text style={styles.roleCardDesc}>Offer skilled services & earn daily</Text>
                </View>
                <View style={[styles.roleCheck, selectedRole === 'WORKER' && styles.roleCheckActive]}>
                  {selectedRole === 'WORKER' && <CheckCircle2 size={16} color="#fff" />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.roleCard, selectedRole === 'SHOP' && styles.roleCardActive]}
                onPress={() => setSelectedRole('SHOP')}
                activeOpacity={0.7}
              >
                <View style={[styles.roleIconBox, { backgroundColor: '#f59e0b15' }]}>
                  <Store size={26} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleCardTitle}>Shop Owner</Text>
                  <Text style={styles.roleCardDesc}>List products & take online orders</Text>
                </View>
                <View style={[styles.roleCheck, selectedRole === 'SHOP' && styles.roleCheckActive]}>
                  {selectedRole === 'SHOP' && <CheckCircle2 size={16} color="#fff" />}
                </View>
              </TouchableOpacity>

              {/* Info Box */}
              <View style={styles.infoBox}>
                <Info size={18} color="#6C47FF" />
                <Text style={styles.infoText}>You can add more roles later from your profile settings.</Text>
              </View>

              <View style={styles.bottomSpacer} />

              <TouchableOpacity style={styles.btnShadow} onPress={handleRoleContinue} activeOpacity={0.8}>
                <LinearGradient
                  colors={['#8B5CF6', '#6C47FF']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.btnGradient}
                >
                  <Text style={styles.btnText}>Continue →</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.footerLink} onPress={() => navigation.navigate('Login', { role: selectedRole })}>
                <Text style={styles.footerText}>Already registered? <Text style={styles.footerLinkText}>Sign In</Text></Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'PHONE' && (
            <View style={styles.body}>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>Enter your details</Text>
                <Text style={styles.subtitle}>We'll send an OTP to verify your number</Text>
              </View>

              <View style={[styles.selectedRoleBadge, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f8f7ff', borderColor: isDarkMode ? '#333' : '#ede9fe' }]}>
                {selectedRole === 'CUSTOMER' && <User size={18} color="#6C47FF" />}
                {selectedRole === 'WORKER' && <Wrench size={18} color="#6C47FF" />}
                {selectedRole === 'SHOP' && <Store size={18} color="#f59e0b" />}
                <Text style={[styles.selectedRoleText, { color: theme.colors.text }]}>
                  Signing up as <Text style={{ fontWeight: '800' }}>{selectedRole === 'WORKER' ? 'Worker / Pro' : selectedRole === 'SHOP' ? 'Shop Owner' : 'Customer'}</Text>
                </Text>
              </View>
              
              {/* Full Name */}
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput 
                style={[styles.nameInput, focusedInput === 'name' && styles.inputFocused]}
                placeholder="Your full name"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                autoCapitalize="words"
                value={fullName}
                onChangeText={setFullName}
                onFocus={() => setFocusedInput('name')}
                onBlur={() => setFocusedInput(null)}
              />

              {/* Mobile Number */}
              <Text style={styles.inputLabel}>Mobile Number</Text>
              <View style={styles.phoneRow}>
                <View style={styles.countryCodeBox}>
                  <Text style={styles.countryFlag}>🇮🇳 +91</Text>
                </View>
                <TextInput 
                  style={[styles.phoneInputBox, focusedInput === 'phone' && styles.inputFocused]}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={isDarkMode ? '#666' : '#999'}
                  keyboardType="number-pad"
                  maxLength={10}
                  value={phoneNumber}
                  onChangeText={(text) => setPhoneNumber(text.replace(/[^0-9]/g, ''))}
                  onFocus={() => setFocusedInput('phone')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              {/* OTP Method Label */}
              <View style={styles.otpLabelBox}>
                <Text style={styles.otpLabelText}>How would you like to receive the OTP?</Text>
              </View>

              {/* OTP Method Cards */}
              <View style={styles.otpCardsContainer}>
                <TouchableOpacity 
                  style={[styles.otpCard, otpMethod === 'SMS' && styles.otpCardActive]}
                  onPress={() => setOtpMethod('SMS')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.otpIconBox, { backgroundColor: '#6C47FF15' }]}>
                    <Text style={{ fontSize: 22 }}>💬</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.otpCardTitle}>SMS</Text>
                    <Text style={styles.otpCardDesc}>Standard text message</Text>
                  </View>
                  <View style={[styles.roleCheck, otpMethod === 'SMS' && styles.roleCheckActive]}>
                    {otpMethod === 'SMS' && <CheckCircle2 size={16} color="#fff" />}
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.otpCard, otpMethod === 'WHATSAPP' && styles.otpCardActive]}
                  onPress={() => setOtpMethod('WHATSAPP')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.otpIconBox, { backgroundColor: '#25D36615' }]}>
                    <Text style={{ fontSize: 22 }}>📱</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.otpCardTitle}>WhatsApp</Text>
                    <Text style={styles.otpCardDesc}>Receive on WhatsApp</Text>
                  </View>
                  <View style={[styles.roleCheck, otpMethod === 'WHATSAPP' && styles.roleCheckActive]}>
                    {otpMethod === 'WHATSAPP' && <CheckCircle2 size={16} color="#fff" />}
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.bottomSpacer} />

              <TouchableOpacity style={[styles.btnShadow, { marginTop: 10 }]} onPress={handlePhoneSubmit} activeOpacity={0.8} disabled={loading}>
                <LinearGradient
                  colors={['#8B5CF6', '#6C47FF']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.btnGradient}
                >
                  <Text style={styles.btnText}>{loading ? 'Sending...' : 'Send OTP →'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

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
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: isDarkMode ? '#333' : '#e5e7eb',
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
    padding: 24,
    flex: 1,
  },
  titleContainer: {
    marginBottom: 20,
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
  roleCard: {
    backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#333333' : '#e5e7eb',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  roleCardActive: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.08)' : '#f8f7ff',
  },
  roleIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  roleCardDesc: {
    fontSize: 13,
    color: theme.colors.textDim,
    fontWeight: '500',
    lineHeight: 18,
  },
  roleCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: isDarkMode ? '#444' : '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleCheckActive: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF',
    borderWidth: 0,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.1)' : '#f5f3ff',
    padding: 16,
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(108, 71, 255, 0.2)' : '#ede9fe',
  },
  infoText: {
    fontSize: 13,
    color: '#6C47FF',
    flex: 1,
    lineHeight: 18,
    fontWeight: '600',
  },
  bottomSpacer: {
    flex: 1,
    minHeight: 24,
  },
  btnShadow: {
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    borderRadius: 20,
    marginBottom: 20,
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
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10,
    marginLeft: 4,
  },
  nameInput: {
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#333333' : '#d1d5db',
    borderRadius: 18,
    paddingHorizontal: 20,
    height: 56,
    marginBottom: 16,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  countryCodeBox: {
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#333333' : '#d1d5db',
    borderRadius: 18,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryFlag: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  phoneInputBox: {
    flex: 1,
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#333333' : '#d1d5db',
    borderRadius: 18,
    paddingHorizontal: 20,
    height: 56,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    letterSpacing: 1,
  },
  inputFocused: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.05)' : '#ffffff',
  },
  otpLabelBox: {
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#333333' : '#d1d5db',
  },
  otpLabelText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textDim,
  },
  otpCardsContainer: {
    flexDirection: 'column',
    gap: 12,
  },
  otpCard: {
    backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#333333' : '#e5e7eb',
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  otpCardActive: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.08)' : '#f8f7ff',
  },
  otpIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 2,
  },
  otpCardDesc: {
    fontSize: 13,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  selectedRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  selectedRoleText: {
    fontSize: 14,
    fontWeight: '600',
  }
});

export default RoleSelection;
