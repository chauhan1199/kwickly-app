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
  Alert,
} from 'react-native';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { User, Wrench, CheckCircle2, Store, Info, ChevronLeft } from 'lucide-react-native';
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
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const validatePhone = (num) => /^[6-9]\d{9}$/.test(num);

  const handleRoleContinue = () => {
    setStep('PHONE');
  };

  const handlePhoneSubmit = async () => {
    if (!validatePhone(phoneNumber)) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number');
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
      console.error(error);
      const errDetails = error.response?.data?.errors?.join(', ') || error.response?.data?.message || 'Connection failed. Please try again.';
      Alert.alert('Error', errDetails);
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      
      {/* Header matching prototype exactly */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => step === 'ROLE' ? navigation.goBack() : setStep('ROLE')}>
            <ChevronLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Account</Text>
          <View style={{width: 36}} />
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
              <Text style={styles.title}>I want to join as...</Text>
              <Text style={styles.subtitle}>Choose your role to get started</Text>

              {/* Role Cards */}
              <TouchableOpacity 
                style={[styles.roleCard, selectedRole === 'CUSTOMER' && styles.roleCardActive]}
                onPress={() => setSelectedRole('CUSTOMER')}
                activeOpacity={0.7}
              >
                <View style={[styles.roleIconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                  <User size={24} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleCardTitle}>Customer</Text>
                  <Text style={styles.roleCardDesc}>Book home services & shop nearby</Text>
                </View>
                <View style={[styles.roleCheck, selectedRole === 'CUSTOMER' && styles.roleCheckActive]}>
                  {selectedRole === 'CUSTOMER' && <CheckCircle2 size={16} color={theme.colors.white} />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.roleCard, selectedRole === 'WORKER' && styles.roleCardActive]}
                onPress={() => setSelectedRole('WORKER')}
                activeOpacity={0.7}
              >
                <View style={[styles.roleIconBox, { backgroundColor: theme.colors.secondary + '15' }]}>
                  <Wrench size={24} color={theme.colors.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleCardTitle}>Worker / Pro</Text>
                  <Text style={styles.roleCardDesc}>Offer skilled services & earn daily</Text>
                </View>
                <View style={[styles.roleCheck, selectedRole === 'WORKER' && styles.roleCheckActive]}>
                  {selectedRole === 'WORKER' && <CheckCircle2 size={16} color={theme.colors.white} />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.roleCard, selectedRole === 'SHOP' && styles.roleCardActive]}
                onPress={() => setSelectedRole('SHOP')}
                activeOpacity={0.7}
              >
                <View style={[styles.roleIconBox, { backgroundColor: '#f59e0b15' }]}>
                  <Store size={24} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleCardTitle}>Shop Owner</Text>
                  <Text style={styles.roleCardDesc}>List products & take online orders</Text>
                </View>
                <View style={[styles.roleCheck, selectedRole === 'SHOP' && styles.roleCheckActive]}>
                  {selectedRole === 'SHOP' && <CheckCircle2 size={16} color={theme.colors.white} />}
                </View>
              </TouchableOpacity>

              {/* Info Box */}
              <View style={styles.infoBox}>
                <Info size={16} color="#3b82f6" />
                <Text style={styles.infoText}>You can add more roles later from your profile settings.</Text>
              </View>

              <TouchableOpacity style={styles.btn} onPress={handleRoleContinue}>
                <Text style={styles.btnText}>Continue →</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.footerLink} onPress={() => navigation.navigate('Login', { role: selectedRole })}>
                <Text style={styles.footerText}>Already registered? <Text style={styles.footerLinkText}>Sign In</Text></Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'PHONE' && (
            <View style={styles.body}>
              <Text style={styles.title}>Enter your details</Text>
              <Text style={styles.subtitle}>We'll send an OTP to verify your number</Text>
              
              {/* Full Name */}
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput 
                style={styles.nameInput}
                placeholder="Your full name"
                placeholderTextColor={theme.colors.textDim}
                autoCapitalize="words"
                value={fullName}
                onChangeText={setFullName}
              />

              {/* Mobile Number */}
              <Text style={styles.inputLabel}>📱 Mobile Number</Text>
              <View style={styles.phoneRow}>
                <View style={styles.countryCodeBox}>
                  <Text style={styles.countryFlag}>🇮🇳 +91</Text>
                </View>
                <TextInput 
                  style={styles.phoneInputBox}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={theme.colors.textDim}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                />
              </View>

              {/* OTP Method Label */}
              <View style={styles.otpLabelBox}>
                <Text style={styles.otpLabelText}>📲 How would you like to receive the OTP?</Text>
              </View>

              {/* OTP Method Cards */}
              <TouchableOpacity 
                style={[styles.otpCard, otpMethod === 'SMS' && styles.otpCardActive]}
                onPress={() => setOtpMethod('SMS')}
                activeOpacity={0.7}
              >
                <View style={[styles.otpIconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                  <Text style={{ fontSize: 20 }}>📱</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.otpCardTitle}>SMS</Text>
                  <Text style={styles.otpCardDesc}>Receive OTP via text message</Text>
                </View>
                <View style={[styles.roleCheck, otpMethod === 'SMS' && styles.roleCheckActive]}>
                  {otpMethod === 'SMS' && <CheckCircle2 size={16} color={theme.colors.white} />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.otpCard, otpMethod === 'WHATSAPP' && styles.otpCardActive]}
                onPress={() => setOtpMethod('WHATSAPP')}
                activeOpacity={0.7}
              >
                <View style={[styles.otpIconBox, { backgroundColor: '#25D36615' }]}>
                  <Text style={{ fontSize: 20 }}>💬</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.otpCardTitle}>WhatsApp</Text>
                  <Text style={styles.otpCardDesc}>Receive OTP on WhatsApp</Text>
                </View>
                <View style={[styles.roleCheck, otpMethod === 'WHATSAPP' && styles.roleCheckActive]}>
                  {otpMethod === 'WHATSAPP' && <CheckCircle2 size={16} color={theme.colors.white} />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btn, { marginTop: 20 }]} onPress={handlePhoneSubmit}>
                <Text style={styles.btnText}>{loading ? 'Sending...' : 'Send OTP →'}</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
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
    backgroundColor: theme.colors.border,
  },
  stepDotActive: {
    width: 24,
    backgroundColor: theme.colors.primary,
  },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    padding: 16,
    flex: 1,
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
    marginBottom: 20,
  },
  roleCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  roleCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(14, 154, 167, 0.08)',
  },
  roleIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  roleCardDesc: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  roleCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleCheckActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 12,
    marginTop: 6,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 12,
    color: '#1e40af',
    flex: 1,
    lineHeight: 18,
  },
  btn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnText: {
    color: '#001016',
    fontWeight: '700',
    fontSize: 15,
  },
  footerLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 13,
    color: theme.colors.textDim,
  },
  footerLinkText: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textDim,
    marginBottom: 6,
  },
  nameInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 16,
    fontSize: 15,
    color: theme.colors.text,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  countryCodeBox: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryFlag: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  phoneInputBox: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 15,
    color: theme.colors.text,
  },
  otpLabelBox: {
    backgroundColor: theme.colors.surfaceMuted || '#f1f4f8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    marginTop: 10,
  },
  otpLabelText: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  otpCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  otpCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(14, 154, 167, 0.08)',
  },
  otpIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  otpCardDesc: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  }
});

export default RoleSelection;
