import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomAlert from '../../components/ui/CustomAlert';
import { useTheme } from '../../context/ThemeContext';
import { User, Wrench, CheckCircle2, Store, Info, ChevronLeft, MessageSquare, Smartphone } from 'lucide-react-native';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';

const RoleSelection = ({ navigation, route }) => {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  // Steps: ROLE -> PHONE -> PASSWORD / OTP
  const [step, setStep] = useState(route?.params?.step || 'ROLE');
  const [selectedRole, setSelectedRole] = useState(route?.params?.role || 'CUSTOMER');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [otpMethod, setOtpMethod] = useState('SMS');
  const [focusedInput, setFocusedInput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' });

  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalModalContent, setLegalModalContent] = useState('');
  const [legalModalTitle, setLegalModalTitle] = useState('');
  const [hasReadTerms, setHasReadTerms] = useState(true);
  const [hasReadPrivacy, setHasReadPrivacy] = useState(true);
  const [acceptedLegal, setAcceptedLegal] = useState(true);
  const [termsText, setTermsText] = useState('');
  const [privacyText, setPrivacyText] = useState('');

  React.useEffect(() => {
    // Fetch public settings for TOS & Privacy Policy
    api.get('/settings/public')
      .then(res => {
        if (res.data?.status === 'success') {
          setTermsText(res.data.data.termsOfService || 'Terms of Service will be updated soon.');
          setPrivacyText(res.data.data.privacyPolicy || 'Privacy Policy will be updated soon.');
        }
      })
      .catch(() => {});
  }, []);

  const openLegalModal = (type) => {
    if (type === 'terms') {
      setLegalModalTitle('Terms of Service');
      setLegalModalContent(termsText);
      setHasReadTerms(true);
    } else {
      setLegalModalTitle('Privacy Policy');
      setLegalModalContent(privacyText);
      setHasReadPrivacy(true);
    }
    setLegalModalVisible(true);
  };

  const showAlert = (title, message, type = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const validatePhone = (num) => /^[6-9]\d{9}$/.test(num);

  const handleRoleContinue = () => {
    setStep('PHONE');
  };

  const handlePhoneSubmit = async () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      showAlert('Validation Error', 'Please enter your full name (minimum 2 characters).');
      return;
    }
    if (!validatePhone(phoneNumber)) {
      showAlert('Validation Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!acceptedLegal) {
      showAlert('Validation Error', 'You must read and accept the Terms of Service and Privacy Policy before continuing.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/check-status', { phone: phoneNumber, role: selectedRole });
      const status = response.data.data;

      if (status.hasMpin || status.hasPassword) {
        navigation.navigate('Login', { prefillPhone: phoneNumber, role: selectedRole, defaultMode: 'MPIN' });
      } else {
        await api.post('/auth/send-otp', { phone: phoneNumber, role: selectedRole });
        navigation.navigate('OTPVerify', {
          phone: phoneNumber,
          role: selectedRole,
          otpMethod: otpMethod,
          fullName: fullName
        });
      }
    } catch (error) {
      const errMessage = error.response?.data?.message || error.message || 'Something went wrong';
      showAlert('Error', errMessage);
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

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => step === 'ROLE' ? navigation.goBack() : setStep('ROLE')}
            activeOpacity={0.7}
          >
            <ChevronLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Create Account</Text>

          <View style={styles.headerRight}>
            <KwicklyIcon size={28} />
          </View>
        </View>

        {/* Step Indicator */}
        <View style={styles.stepDots}>
          <View style={[styles.stepDot, step === 'ROLE' ? styles.stepDotActive : styles.stepDotCompleted]} />
          <View style={[styles.stepDot, step === 'PHONE' && styles.stepDotActive]} />
          <View style={styles.stepDot} />
          <View style={styles.stepDot} />
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {step === 'ROLE' && (
            <View style={styles.body}>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>I want to join as...</Text>
                <Text style={styles.subtitle}>Choose your profile type to get started</Text>
              </View>

              {/* Role Cards */}
              <TouchableOpacity
                style={[styles.roleCard, selectedRole === 'CUSTOMER' && styles.roleCardActive]}
                onPress={() => setSelectedRole('CUSTOMER')}
                activeOpacity={0.7}
              >
                <View style={[styles.roleIconBox, { backgroundColor: 'rgba(108, 71, 255, 0.12)' }]}>
                  <User size={26} color="#6C47FF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleCardTitle}>Customer</Text>
                  <Text style={styles.roleCardDesc}>Book on-demand services & nearby shops</Text>
                </View>
                <View style={[styles.roleCheck, selectedRole === 'CUSTOMER' && styles.roleCheckActive]}>
                  {selectedRole === 'CUSTOMER' && <CheckCircle2 size={16} color="#FFF" />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleCard, selectedRole === 'WORKER' && styles.roleCardActive]}
                onPress={() => setSelectedRole('WORKER')}
                activeOpacity={0.7}
              >
                <View style={[styles.roleIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                  <Wrench size={26} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleCardTitle}>Worker / Professional</Text>
                  <Text style={styles.roleCardDesc}>Offer expert services & earn daily</Text>
                </View>
                <View style={[styles.roleCheck, selectedRole === 'WORKER' && styles.roleCheckActive]}>
                  {selectedRole === 'WORKER' && <CheckCircle2 size={16} color="#FFF" />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleCard, selectedRole === 'SHOP' && styles.roleCardActive]}
                onPress={() => setSelectedRole('SHOP')}
                activeOpacity={0.7}
              >
                <View style={[styles.roleIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                  <Store size={26} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleCardTitle}>Shop Owner</Text>
                  <Text style={styles.roleCardDesc}>List products & receive instant orders</Text>
                </View>
                <View style={[styles.roleCheck, selectedRole === 'SHOP' && styles.roleCheckActive]}>
                  {selectedRole === 'SHOP' && <CheckCircle2 size={16} color="#FFF" />}
                </View>
              </TouchableOpacity>

              {/* Info Box */}
              <View style={styles.infoBox}>
                <Info size={18} color="#6C47FF" />
                <Text style={styles.infoText}>You can add or switch roles later anytime from your profile.</Text>
              </View>

              <View style={styles.bottomSpacer} />

              <TouchableOpacity style={styles.btnShadow} onPress={handleRoleContinue} activeOpacity={0.88}>
                <LinearGradient
                  colors={['#7C3AED', '#6C47FF']}
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
                <Text style={styles.subtitle}>We'll send a 6-digit OTP to verify your number</Text>
              </View>

              {/* Role selector pill tabs */}
              <View style={{ marginBottom: 18 }}>
                <Text style={styles.inputLabel}>Registering As</Text>
                <View style={styles.roleTabRow}>
                  {[
                    { id: 'CUSTOMER', label: 'Customer', icon: User },
                    { id: 'WORKER', label: 'Worker', icon: Wrench },
                    { id: 'SHOP', label: 'Shop', icon: Store },
                  ].map(r => {
                    const IconComp = r.icon;
                    const isActive = selectedRole === r.id;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        onPress={() => setSelectedRole(r.id)}
                        style={[styles.miniRoleTab, isActive && styles.miniRoleTabActive]}
                        activeOpacity={0.7}
                      >
                        <IconComp size={15} color={isActive ? '#6C47FF' : theme.colors.textDim} />
                        <Text style={[styles.miniRoleText, isActive && styles.miniRoleTextActive]}>
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Full Name */}
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={[styles.nameInput, focusedInput === 'name' && styles.inputFocused]}
                placeholder="Enter your full name"
                placeholderTextColor={theme.colors.textDim}
                autoCapitalize="words"
                autoCorrect={false}
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
                  placeholder="10-digit number"
                  placeholderTextColor={theme.colors.textDim}
                  keyboardType="number-pad"
                  maxLength={10}
                  value={phoneNumber}
                  onChangeText={(text) => setPhoneNumber(text.replace(/[^0-9]/g, ''))}
                  onFocus={() => setFocusedInput('phone')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              {/* OTP Method */}
              <Text style={[styles.inputLabel, { marginTop: 4 }]}>Receive OTP Via</Text>
              <View style={styles.otpCardsContainer}>
                <TouchableOpacity
                  style={[styles.otpCard, otpMethod === 'SMS' && styles.otpCardActive]}
                  onPress={() => setOtpMethod('SMS')}
                  activeOpacity={0.7}
                >
                  <View style={styles.otpCardTop}>
                    <View style={[styles.otpIconBox, { backgroundColor: 'rgba(108, 71, 255, 0.12)' }]}>
                      <MessageSquare size={18} color="#6C47FF" />
                    </View>
                    <View style={[styles.roleCheck, otpMethod === 'SMS' && styles.roleCheckActive]}>
                      {otpMethod === 'SMS' && <CheckCircle2 size={14} color="#FFF" />}
                    </View>
                  </View>
                  <Text style={styles.otpCardTitle} numberOfLines={1}>SMS</Text>
                  <Text style={styles.otpCardDesc} numberOfLines={1}>Standard text</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.otpCard, otpMethod === 'WHATSAPP' && styles.otpCardActive]}
                  onPress={() => setOtpMethod('WHATSAPP')}
                  activeOpacity={0.7}
                >
                  <View style={styles.otpCardTop}>
                    <View style={[styles.otpIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                      <Smartphone size={18} color="#10B981" />
                    </View>
                    <View style={[styles.roleCheck, otpMethod === 'WHATSAPP' && styles.roleCheckActive]}>
                      {otpMethod === 'WHATSAPP' && <CheckCircle2 size={14} color="#FFF" />}
                    </View>
                  </View>
                  <Text style={styles.otpCardTitle} numberOfLines={1}>WhatsApp</Text>
                  <Text style={styles.otpCardDesc} numberOfLines={1}>Instant message</Text>
                </TouchableOpacity>
              </View>

              {/* Legal Checkbox */}
              <View style={styles.legalBox}>
                <TouchableOpacity
                  style={[styles.checkbox, acceptedLegal && styles.checkboxActive]}
                  onPress={() => setAcceptedLegal(!acceptedLegal)}
                  activeOpacity={0.8}
                >
                  {acceptedLegal && <CheckCircle2 size={15} color="#FFF" />}
                </TouchableOpacity>
                <Text style={styles.legalText}>
                  I agree to the{' '}
                  <Text style={styles.legalLink} onPress={() => openLegalModal('terms')}>Terms</Text>
                  {' '}&{' '}
                  <Text style={styles.legalLink} onPress={() => openLegalModal('privacy')}>Privacy Policy</Text>.
                </Text>
              </View>

              <View style={styles.bottomSpacer} />

              <TouchableOpacity style={styles.btnShadow} onPress={handlePhoneSubmit} activeOpacity={0.88} disabled={loading}>
                <LinearGradient
                  colors={(!acceptedLegal) ? ['#CBD5E1', '#94A3B8'] : ['#7C3AED', '#6C47FF']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.btnGradient}
                >
                  <Text style={styles.btnText}>{loading ? 'Sending OTP...' : 'Send OTP →'}</Text>
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

      {/* Legal Modal */}
      <Modal visible={legalModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setLegalModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{legalModalTitle}</Text>
            <TouchableOpacity onPress={() => setLegalModalVisible(false)} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={{ fontSize: 14, color: theme.colors.text, lineHeight: 22 }}>{legalModalContent}</Text>
          </ScrollView>
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
    marginBottom: 10,
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
  stepDotCompleted: {
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
  titleContainer: {
    marginBottom: 18,
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
    fontWeight: '500',
  },
  roleCard: {
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  roleCardActive: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.12)' : '#F5F3FF',
  },
  roleIconBox: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 2,
  },
  roleCardDesc: {
    fontSize: 12.5,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  roleCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: isDarkMode ? '#475569' : '#CBD5E1',
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
    gap: 10,
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.1)' : '#F5F3FF',
    padding: 14,
    borderRadius: 14,
    marginTop: 4,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(108, 71, 255, 0.2)' : '#EDE9FE',
  },
  infoText: {
    fontSize: 12.5,
    color: '#6C47FF',
    flex: 1,
    lineHeight: 17,
    fontWeight: '600',
  },
  roleTabRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  miniRoleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    gap: 6,
  },
  miniRoleTabActive: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#F5F3FF',
  },
  miniRoleText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: theme.colors.textDim,
  },
  miniRoleTextActive: {
    color: '#6C47FF',
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
    marginLeft: 2,
  },
  nameInput: {
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 14,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  countryCodeBox: {
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryFlag: {
    fontSize: 14.5,
    fontWeight: '700',
    color: theme.colors.text,
  },
  phoneInputBox: {
    flex: 1,
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  inputFocused: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.06)' : '#FFFFFF',
  },
  otpCardsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  otpCard: {
    flex: 1,
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: 16,
    padding: 12,
  },
  otpCardActive: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.12)' : '#F5F3FF',
  },
  otpCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  otpIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 2,
  },
  otpCardDesc: {
    fontSize: 11,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  legalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: isDarkMode ? '#475569' : '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#131B2E' : '#FFF',
  },
  checkboxActive: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF',
    borderWidth: 0,
  },
  legalText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.textDim,
  },
  legalLink: {
    color: '#6C47FF',
    fontWeight: '700',
  },
  bottomSpacer: {
    flex: 1,
    minHeight: 20,
  },
  btnShadow: {
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    borderRadius: 16,
    marginBottom: 12,
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
  footerLink: {
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 8,
  },
  footerText: {
    fontSize: 13.5,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  footerLinkText: {
    color: '#6C47FF',
    fontWeight: '800',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#1E293B' : '#E2E8F0',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseText: {
    fontSize: 15,
    color: '#6C47FF',
    fontWeight: '700',
  },
});

export default RoleSelection;
