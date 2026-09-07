import React, { useState, useEffect, useRef } from 'react';
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
  Modal,
  Keyboard,
  ActivityIndicator
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomAlert from '../../components/ui/CustomAlert';
import { useTheme } from '../../context/ThemeContext';
import { User, Wrench, Store, CheckCircle2, ChevronLeft, MessageSquare, Smartphone, ShieldCheck } from 'lucide-react-native';
import api, { getApiErrorMessage } from '../../services/api';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';

const ROLE_OPTIONS = [
  { id: 'CUSTOMER', label: 'Customer', icon: User, desc: 'Book on-demand services' },
  { id: 'WORKER', label: 'Worker', icon: Wrench, desc: 'Offer expert skills' },
  { id: 'SHOP', label: 'Shop', icon: Store, desc: 'Sell catalog items' },
];

const RoleSelection = ({ navigation, route }) => {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedRole, setSelectedRole] = useState(route?.params?.role || 'CUSTOMER');
  const [phoneNumber, setPhoneNumber] = useState(route?.params?.prefillPhone || '');
  const [fullName, setFullName] = useState('');
  const [otpMethod, setOtpMethod] = useState('SMS');
  const [focusedInput, setFocusedInput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' });

  // Keyboard avoidance state
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef(null);
  const phoneInputRef = useRef(null);

  // Legal Modal
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalModalContent, setLegalModalContent] = useState('');
  const [legalModalTitle, setLegalModalTitle] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(true);
  const [termsText, setTermsText] = useState('');
  const [privacyText, setPrivacyText] = useState('');

  useEffect(() => {
    // Keyboard listeners to guarantee active inputs & submit button are never hidden
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates?.height || 260);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    // Fetch public TOS & Privacy Policy
    api.get('/settings/public')
      .then(res => {
        if (res.data?.status === 'success') {
          setTermsText(res.data.data.termsOfService || 'Terms of Service will be updated soon.');
          setPrivacyText(res.data.data.privacyPolicy || 'Privacy Policy will be updated soon.');
        }
      })
      .catch(() => {});

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const openLegalModal = (type) => {
    if (type === 'terms') {
      setLegalModalTitle('Terms of Service');
      setLegalModalContent(termsText);
    } else {
      setLegalModalTitle('Privacy Policy');
      setLegalModalContent(privacyText);
    }
    setLegalModalVisible(true);
  };

  const showAlert = (title, message, type = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const validatePhone = (num) => /^[6-9]\d{9}$/.test(num);

  const handlePhoneSubmit = async () => {
    Keyboard.dismiss();

    if (!fullName.trim() || fullName.trim().length < 2) {
      showAlert('Validation Error', 'Please enter your full name (minimum 2 characters).');
      return;
    }
    if (!validatePhone(phoneNumber)) {
      showAlert('Validation Error', 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
      return;
    }
    if (!acceptedLegal) {
      showAlert('Validation Error', 'You must agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/check-status', { phone: phoneNumber, role: selectedRole });
      const status = response.data?.data || {};

      if (status.hasMpin || status.hasPassword) {
        navigation.navigate('Login', { prefillPhone: phoneNumber, role: selectedRole, defaultMode: 'MPIN' });
      } else {
        await api.post('/auth/send-otp', { phone: phoneNumber, role: selectedRole, method: otpMethod });
        navigation.navigate('OTPVerify', {
          phone: phoneNumber,
          role: selectedRole,
          otpMethod: otpMethod,
          fullName: fullName.trim()
        });
      }
    } catch (error) {
      const errMessage = getApiErrorMessage(error, 'Something went wrong. Please try again.');
      showAlert('Error', errMessage);
    } finally {
      setLoading(false);
    }
  };

  const scrollToInput = (yOffset = 180) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: yOffset, animated: true });
    }, 150);
  };

  const headerTopPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 8;
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 16) + 20;
  const dynamicBottomPad = bottomPad + (keyboardVisible ? keyboardHeight + 24 : 16);
  const styles = createStyles(theme, isDarkMode, headerTopPad, dynamicBottomPad);

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
            onPress={() => navigation.goBack()}
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
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={styles.stepDot} />
          <View style={styles.stepDot} />
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
      >
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.body}>

            {/* Title Section */}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Enter your details</Text>
              <Text style={styles.subtitle}>We'll send a 4-digit OTP to verify your number</Text>
            </View>

            {/* Role Selector Tabs */}
            <View style={styles.sectionGroup}>
              <Text style={styles.inputLabel}>Registering As</Text>
              <View style={styles.roleTabRow}>
                {ROLE_OPTIONS.map((r) => {
                  const IconComp = r.icon;
                  const isActive = selectedRole === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => {
                        setSelectedRole(r.id);
                        Keyboard.dismiss();
                      }}
                      style={[styles.roleTab, isActive && styles.roleTabActive]}
                      activeOpacity={0.75}
                    >
                      <IconComp size={16} color={isActive ? '#6C47FF' : theme.colors.textDim} />
                      <Text style={[styles.roleTabText, isActive && styles.roleTabTextActive]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Form Inputs */}
            <View style={styles.formCard}>
              {/* Full Name */}
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={[styles.inputWrapper, focusedInput === 'name' && styles.inputFocused]}>
                <View style={styles.inputIcon}>
                  <User size={18} color={focusedInput === 'name' ? '#6C47FF' : theme.colors.textDim} />
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your full name"
                  placeholderTextColor={theme.colors.textDim}
                  autoCapitalize="words"
                  autoCorrect={false}
                  value={fullName}
                  onChangeText={setFullName}
                  onFocus={() => {
                    setFocusedInput('name');
                    scrollToInput(60);
                  }}
                  onBlur={() => setFocusedInput(null)}
                  returnKeyType="next"
                  onSubmitEditing={() => phoneInputRef.current?.focus()}
                />
              </View>

              {/* Mobile Number */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Mobile Number</Text>
              <View style={[styles.inputWrapper, focusedInput === 'phone' && styles.inputFocused]}>
                <View style={styles.countryCodeBadge}>
                  <Text style={styles.flagText}>🇮🇳 +91</Text>
                </View>
                <TextInput
                  ref={phoneInputRef}
                  style={styles.textInput}
                  placeholder="10-digit number"
                  placeholderTextColor={theme.colors.textDim}
                  keyboardType="number-pad"
                  maxLength={10}
                  value={phoneNumber}
                  onChangeText={(text) => setPhoneNumber(text.replace(/[^0-9]/g, ''))}
                  onFocus={() => {
                    setFocusedInput('phone');
                    scrollToInput(140);
                  }}
                  onBlur={() => setFocusedInput(null)}
                  returnKeyType="done"
                  onSubmitEditing={handlePhoneSubmit}
                />
              </View>

              {/* Receive OTP Via */}
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Receive OTP Via</Text>
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
                    <View style={[styles.methodCheck, otpMethod === 'SMS' && styles.methodCheckActive]}>
                      {otpMethod === 'SMS' && <CheckCircle2 size={13} color="#FFFFFF" />}
                    </View>
                  </View>
                  <Text style={styles.otpCardTitle}>SMS</Text>
                  <Text style={styles.otpCardDesc}>Standard text</Text>
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
                    <View style={[styles.methodCheck, otpMethod === 'WHATSAPP' && styles.methodCheckActive]}>
                      {otpMethod === 'WHATSAPP' && <CheckCircle2 size={13} color="#FFFFFF" />}
                    </View>
                  </View>
                  <Text style={styles.otpCardTitle}>WhatsApp</Text>
                  <Text style={styles.otpCardDesc}>Instant message</Text>
                </TouchableOpacity>
              </View>

              {/* Terms & Conditions Checkbox */}
              <View style={styles.legalBox}>
                <TouchableOpacity
                  style={[styles.checkbox, acceptedLegal && styles.checkboxActive]}
                  onPress={() => setAcceptedLegal(!acceptedLegal)}
                  activeOpacity={0.8}
                >
                  {acceptedLegal && <CheckCircle2 size={15} color="#FFFFFF" />}
                </TouchableOpacity>
                <Text style={styles.legalText}>
                  I agree to the{' '}
                  <Text style={styles.legalLink} onPress={() => openLegalModal('terms')}>Terms</Text>
                  {' '}&{' '}
                  <Text style={styles.legalLink} onPress={() => openLegalModal('privacy')}>Privacy Policy</Text>.
                </Text>
              </View>
            </View>

            <View style={styles.spacer} />

            {/* Submit Action Button */}
            <TouchableOpacity 
              style={[styles.btnShadow, { opacity: (acceptedLegal && phoneNumber.length === 10 && fullName.trim().length >= 2 && !loading) ? 1 : 0.65 }]} 
              onPress={handlePhoneSubmit} 
              activeOpacity={0.88} 
              disabled={loading || !acceptedLegal || phoneNumber.length !== 10 || fullName.trim().length < 2}
            >
              <LinearGradient
                colors={['#7C3AED', '#6C47FF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.btnGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.btnText}>Send OTP →</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Already registered Footer */}
            <TouchableOpacity 
              style={styles.footerLink} 
              onPress={() => navigation.navigate('Login', { role: selectedRole })}
              activeOpacity={0.7}
            >
              <Text style={styles.footerText}>
                Already registered? <Text style={styles.footerLinkText}>Sign In</Text>
              </Text>
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

const createStyles = (theme, isDarkMode, headerTopPad, bottomPad = 32) => StyleSheet.create({
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
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
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
  stepDotActive: {
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6C47FF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: bottomPad,
  },
  body: {
    padding: 20,
    width: '100%',
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
  sectionGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
    marginLeft: 2,
  },
  roleTabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  roleTabActive: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.14)' : '#F5F3FF',
  },
  roleTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textDim,
  },
  roleTabTextActive: {
    color: '#6C47FF',
    fontWeight: '800',
  },
  formCard: {
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 12,
  },
  inputFocused: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.06)' : '#FFFFFF',
  },
  inputIcon: {
    marginRight: 10,
  },
  countryCodeBadge: {
    marginRight: 8,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: isDarkMode ? '#334155' : '#CBD5E1',
  },
  flagText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    padding: 0,
  },
  otpCardsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 14,
  },
  otpCard: {
    flex: 1,
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: 14,
    padding: 12,
  },
  otpCardActive: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.12)' : '#F5F3FF',
  },
  otpCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  otpIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#475569' : '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodCheckActive: {
    borderColor: '#6C47FF',
    backgroundColor: '#6C47FF',
  },
  otpCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  otpCardDesc: {
    fontSize: 11,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  legalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#475569' : '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxActive: {
    borderColor: '#6C47FF',
    backgroundColor: '#6C47FF',
  },
  legalText: {
    fontSize: 12.5,
    color: theme.colors.textDim,
    flex: 1,
    lineHeight: 18,
  },
  legalLink: {
    color: '#6C47FF',
    fontWeight: '800',
  },
  spacer: {
    height: 12,
  },
  btnShadow: {
    width: '100%',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
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
  footerLink: {
    alignItems: 'center',
    paddingVertical: 8,
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  modalCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalCloseText: {
    color: '#6C47FF',
    fontWeight: '800',
    fontSize: 15,
  },
});

export default RoleSelection;
