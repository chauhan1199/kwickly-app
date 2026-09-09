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
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomAlert from '../../components/ui/CustomAlert';
import { useTheme } from '../../context/ThemeContext';
import {
  User,
  Wrench,
  Store,
  CheckCircle2,
  ChevronLeft,
  MessageSquare,
  Smartphone,
  ShieldCheck,
  X,
  Sparkles,
  ArrowRight,
  Check,
} from 'lucide-react-native';
import api, { getApiErrorMessage } from '../../services/api';

const { width: SW, height: SH } = Dimensions.get('window');

const ROLE_OPTIONS = [
  {
    id: 'CUSTOMER',
    label: 'Customer',
    icon: User,
    tag: 'Book Services',
    color: '#6C47FF',
    accentBg: 'rgba(108, 71, 255, 0.12)',
    desc: 'Book on-demand services',
  },
  {
    id: 'WORKER',
    label: 'Worker',
    icon: Wrench,
    tag: 'Earn & Work',
    color: '#10B981',
    accentBg: 'rgba(16, 185, 129, 0.12)',
    desc: 'Offer expert skills',
  },
  {
    id: 'SHOP',
    label: 'Shop',
    icon: Store,
    tag: 'Sell Catalog',
    color: '#F59E0B',
    accentBg: 'rgba(245, 158, 11, 0.12)',
    desc: 'Sell catalog items',
  },
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
          fullName: fullName.trim(),
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
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16) + 20;
  const dynamicBottomPad = bottomPad + (keyboardVisible ? keyboardHeight + 20 : 16);
  const styles = createStyles(theme, isDarkMode, headerTopPad, dynamicBottomPad);

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0A0F1D' : '#F8FAFC' }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent={true}
      />

      {/* Atmospheric Ambient Glow Orbs */}
      <View style={styles.ambientContainer} pointerEvents="none">
        <View style={styles.orbTopRight}>
          <LinearGradient
            colors={['#6C47FF', '#3B82F6']}
            style={StyleSheet.fillObject}
          />
        </View>
        <View style={styles.orbBottomLeft}>
          <LinearGradient
            colors={['#7C3AED', '#10B981']}
            style={StyleSheet.fillObject}
          />
        </View>
      </View>

      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerRight} />
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

            {/* Title & Brand Intro */}
            <View style={styles.titleContainer}>
              <View style={styles.badgePill}>
                <Sparkles size={13} color="#6C47FF" />
                <Text style={styles.badgePillText}>Get Started with Kwickly</Text>
              </View>
              <Text style={styles.title}>Create your Account</Text>
              <Text style={styles.subtitle}>Choose your role and register to get started in seconds</Text>
            </View>

            {/* Role Selector Grid */}
            <View style={styles.sectionGroup}>
              <Text style={styles.sectionHeaderLabel}>REGISTERING AS</Text>
              <View style={styles.roleGrid}>
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
                      style={[
                        styles.roleCard,
                        isActive && [
                          styles.roleCardActive,
                          {
                            borderColor: r.color,
                            backgroundColor: isDarkMode ? 'rgba(30, 27, 75, 0.45)' : '#F5F3FF',
                          },
                        ],
                      ]}
                      activeOpacity={0.75}
                    >
                      {isActive && (
                        <View style={[styles.roleActiveBadge, { backgroundColor: r.color }]}>
                          <Check size={9} color="#FFFFFF" strokeWidth={3} />
                        </View>
                      )}
                      <View
                        style={[
                          styles.roleIconCircle,
                          {
                            backgroundColor: isActive
                              ? r.color
                              : (isDarkMode ? '#1E293B' : '#F1F5F9'),
                          },
                        ]}
                      >
                        <IconComp
                          size={18}
                          color={isActive ? '#FFFFFF' : (isDarkMode ? '#94A3B8' : '#64748B')}
                        />
                      </View>
                      <Text
                        style={[
                          styles.roleName,
                          isActive && { color: r.color, fontWeight: '800' },
                        ]}
                      >
                        {r.label}
                      </Text>
                      <View
                        style={[
                          styles.roleTagPill,
                          isActive && { backgroundColor: r.accentBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleTagText,
                            isActive && { color: r.color, fontWeight: '700' },
                          ]}
                        >
                          {r.tag}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Elevated Form Card */}
            <View style={styles.formCard}>
              {/* Full Name Field */}
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={[styles.inputWrapper, focusedInput === 'name' && styles.inputFocused]}>
                  <View style={styles.inputIconCircle}>
                    <User size={17} color={focusedInput === 'name' ? '#6C47FF' : theme.colors.textDim} />
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
                  {fullName.trim().length >= 2 && (
                    <View style={styles.validCheckBadge}>
                      <CheckCircle2 size={16} color="#10B981" />
                    </View>
                  )}
                </View>
              </View>

              {/* Mobile Number Field */}
              <View style={[styles.inputBlock, { marginTop: 16 }]}>
                <Text style={styles.inputLabel}>Mobile Number</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    focusedInput === 'phone' && styles.inputFocused,
                    phoneNumber.length === 10 && validatePhone(phoneNumber) && styles.inputReady,
                  ]}
                >
                  <View style={styles.countryBadge}>
                    <Text style={styles.countryFlag}>🇮🇳</Text>
                    <Text style={styles.countryPrefix}>+91</Text>
                    <View style={styles.countryDivider} />
                  </View>
                  <TextInput
                    ref={phoneInputRef}
                    style={styles.textInput}
                    placeholder="10-digit number"
                    placeholderTextColor={theme.colors.textDim}
                    keyboardType="number-pad"
                    maxLength={10}
                    value={phoneNumber}
                    onChangeText={(text) => {
                      const clean = text.replace(/[^0-9]/g, '').slice(0, 10);
                      setPhoneNumber(clean);
                      if (clean.length === 10 && validatePhone(clean) && fullName.trim().length >= 2) {
                        Keyboard.dismiss();
                      }
                    }}
                    onFocus={() => {
                      setFocusedInput('phone');
                      scrollToInput(140);
                    }}
                    onBlur={() => setFocusedInput(null)}
                    returnKeyType="done"
                    onSubmitEditing={handlePhoneSubmit}
                  />
                  {phoneNumber.length === 10 && validatePhone(phoneNumber) ? (
                    <View style={styles.validCheckBadge}>
                      <CheckCircle2 size={18} color="#10B981" />
                    </View>
                  ) : phoneNumber.length > 0 ? (
                    <TouchableOpacity onPress={() => setPhoneNumber('')} style={styles.clearBadge}>
                      <X size={15} color={theme.colors.textDim} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {/* Receive OTP Via Channel Cards */}
              <View style={[styles.inputBlock, { marginTop: 18 }]}>
                <Text style={styles.inputLabel}>Receive OTP Via</Text>
                <View style={styles.otpMethodsRow}>
                  {/* SMS Card */}
                  <TouchableOpacity
                    style={[
                      styles.otpMethodCard,
                      otpMethod === 'SMS' && styles.otpMethodCardActiveSms,
                    ]}
                    onPress={() => setOtpMethod('SMS')}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.otpMethodIconBox, { backgroundColor: 'rgba(108, 71, 255, 0.12)' }]}>
                      <MessageSquare size={17} color="#6C47FF" />
                    </View>
                    <View style={styles.otpMethodInfo}>
                      <Text style={[styles.otpMethodTitle, otpMethod === 'SMS' && { color: '#6C47FF' }]}>
                        SMS
                      </Text>
                      <Text style={styles.otpMethodSubtitle}>Instant text</Text>
                    </View>
                    <View style={[styles.radioCircle, otpMethod === 'SMS' && styles.radioCircleActiveSms]}>
                      {otpMethod === 'SMS' && <View style={styles.radioInnerDotSms} />}
                    </View>
                  </TouchableOpacity>

                  {/* WhatsApp Card */}
                  <TouchableOpacity
                    style={[
                      styles.otpMethodCard,
                      otpMethod === 'WHATSAPP' && styles.otpMethodCardActiveWa,
                    ]}
                    onPress={() => setOtpMethod('WHATSAPP')}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.otpMethodIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                      <Smartphone size={17} color="#10B981" />
                    </View>
                    <View style={styles.otpMethodInfo}>
                      <Text style={[styles.otpMethodTitle, otpMethod === 'WHATSAPP' && { color: '#10B981' }]}>
                        WhatsApp
                      </Text>
                      <Text style={styles.otpMethodSubtitle}>Instant chat</Text>
                    </View>
                    <View style={[styles.radioCircle, otpMethod === 'WHATSAPP' && styles.radioCircleActiveWa]}>
                      {otpMethod === 'WHATSAPP' && <View style={styles.radioInnerDotWa} />}
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Terms & Privacy Policy Checkbox */}
              <View style={styles.legalRow}>
                <TouchableOpacity
                  style={[styles.checkboxSquircle, acceptedLegal && styles.checkboxSquircleActive]}
                  onPress={() => setAcceptedLegal(!acceptedLegal)}
                  activeOpacity={0.75}
                >
                  {acceptedLegal && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                </TouchableOpacity>
                <Text style={styles.legalText}>
                  I agree to the{' '}
                  <Text style={styles.legalLink} onPress={() => openLegalModal('terms')}>
                    Terms of Service
                  </Text>
                  {' '}&{' '}
                  <Text style={styles.legalLink} onPress={() => openLegalModal('privacy')}>
                    Privacy Policy
                  </Text>
                </Text>
              </View>
            </View>

            {/* Submit Action Button */}
            <TouchableOpacity
              style={[
                styles.btnShadow,
                {
                  opacity:
                    acceptedLegal &&
                    phoneNumber.length === 10 &&
                    fullName.trim().length >= 2 &&
                    !loading
                      ? 1
                      : 0.6,
                },
              ]}
              onPress={handlePhoneSubmit}
              activeOpacity={0.88}
              disabled={loading || !acceptedLegal || phoneNumber.length !== 10 || fullName.trim().length < 2}
            >
              <LinearGradient
                colors={['#7C3AED', '#6C47FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.btnGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.btnContent}>
                    <Text style={styles.btnText}>Send OTP</Text>
                    <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                  </View>
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

            {/* Trust Guarantee Badge */}
            <View style={styles.trustBadgeRow}>
              <ShieldCheck size={14} color="#10B981" style={{ marginRight: 6 }} />
              <Text style={styles.trustBadgeText}>Bank-grade 256-bit encryption • 100% Secure</Text>
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

      {/* Legal Modal */}
      <Modal
        visible={legalModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setLegalModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{legalModalTitle}</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setLegalModalVisible(false)}>
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={{ fontSize: 14, color: theme.colors.text, lineHeight: 22 }}>
              {legalModalContent}
            </Text>
          </ScrollView>
        </View>
      </Modal>

    </View>
  );
};

const createStyles = (theme, isDarkMode, headerTopPad, bottomPad = 32) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    ambientContainer: {
      ...StyleSheet.fillObject,
      overflow: 'hidden',
    },
    orbTopRight: {
      position: 'absolute',
      top: -80,
      right: -80,
      width: 260,
      height: 260,
      borderRadius: 130,
      opacity: isDarkMode ? 0.18 : 0.12,
    },
    orbBottomLeft: {
      position: 'absolute',
      bottom: SH * 0.15,
      left: -90,
      width: 280,
      height: 280,
      borderRadius: 140,
      opacity: isDarkMode ? 0.15 : 0.09,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: headerTopPad,
      paddingBottom: 4,
      zIndex: 3,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
      borderWidth: 1.2,
      borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    headerRight: {
      width: 40,
      height: 40,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: bottomPad,
    },
    body: {
      paddingHorizontal: 18,
      paddingTop: 6,
      width: '100%',
    },
    titleContainer: {
      marginBottom: 16,
    },
    badgePill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.18)' : '#EDE9FE',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(108, 71, 255, 0.35)' : '#DDD6FE',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      marginBottom: 8,
      gap: 6,
    },
    badgePillText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#6C47FF',
      letterSpacing: 0.2,
    },
    title: {
      fontSize: 26,
      fontWeight: '900',
      color: theme.colors.text,
      marginBottom: 4,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 13.5,
      color: theme.colors.textDim,
      fontWeight: '500',
      lineHeight: 19,
    },
    sectionGroup: {
      marginBottom: 14,
    },
    sectionHeaderLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.colors.textDim,
      letterSpacing: 0.8,
      marginBottom: 8,
      marginLeft: 2,
    },
    roleGrid: {
      flexDirection: 'row',
      gap: 9,
    },
    roleCard: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
      borderWidth: 1.5,
      borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 6,
      position: 'relative',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 5,
      elevation: 2,
    },
    roleCardActive: {
      borderWidth: 2,
      shadowColor: '#6C47FF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 8,
      elevation: 4,
    },
    roleActiveBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 15,
      height: 15,
      borderRadius: 7.5,
      justifyContent: 'center',
      alignItems: 'center',
    },
    roleIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 6,
    },
    roleName: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
    },
    roleTagPill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
    },
    roleTagText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.colors.textDim,
    },
    formCard: {
      backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
      borderRadius: 22,
      padding: 18,
      borderWidth: 1.2,
      borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
      shadowColor: '#6C47FF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 14,
      elevation: 3,
      marginBottom: 16,
    },
    inputBlock: {
      width: '100%',
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 6,
      marginLeft: 2,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC',
      borderWidth: 1.5,
      borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
      borderRadius: 14,
      height: 52,
      paddingHorizontal: 12,
    },
    inputFocused: {
      borderColor: '#6C47FF',
      backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.06)' : '#FFFFFF',
      shadowColor: '#6C47FF',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 2,
    },
    inputReady: {
      borderColor: '#10B981',
    },
    inputIconCircle: {
      width: 30,
      height: 30,
      borderRadius: 9,
      backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
    },
    countryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 8,
    },
    countryFlag: {
      fontSize: 16,
      marginRight: 4,
    },
    countryPrefix: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.text,
      marginRight: 8,
    },
    countryDivider: {
      width: 1,
      height: 20,
      backgroundColor: isDarkMode ? '#334155' : '#CBD5E1',
    },
    textInput: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
      padding: 0,
    },
    validCheckBadge: {
      padding: 4,
    },
    clearBadge: {
      padding: 6,
    },
    otpMethodsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 2,
    },
    otpMethodCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC',
      borderWidth: 1.5,
      borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 10,
    },
    otpMethodCardActiveSms: {
      borderColor: '#6C47FF',
      backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.12)' : '#F5F3FF',
    },
    otpMethodCardActiveWa: {
      borderColor: '#10B981',
      backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.12)' : '#F0FDF4',
    },
    otpMethodIconBox: {
      width: 32,
      height: 32,
      borderRadius: 9,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    otpMethodInfo: {
      flex: 1,
    },
    otpMethodTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.text,
    },
    otpMethodSubtitle: {
      fontSize: 10.5,
      color: theme.colors.textDim,
      marginTop: 1,
    },
    radioCircle: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: isDarkMode ? '#475569' : '#CBD5E1',
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioCircleActiveSms: {
      borderColor: '#6C47FF',
    },
    radioInnerDotSms: {
      width: 9,
      height: 9,
      borderRadius: 4.5,
      backgroundColor: '#6C47FF',
    },
    radioCircleActiveWa: {
      borderColor: '#10B981',
    },
    radioInnerDotWa: {
      width: 9,
      height: 9,
      borderRadius: 4.5,
      backgroundColor: '#10B981',
    },
    legalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? '#1E293B' : '#F1F5F9',
    },
    checkboxSquircle: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: isDarkMode ? '#475569' : '#CBD5E1',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
    },
    checkboxSquircleActive: {
      borderColor: '#6C47FF',
      backgroundColor: '#6C47FF',
    },
    legalText: {
      fontSize: 12,
      color: theme.colors.textDim,
      flex: 1,
      lineHeight: 18,
    },
    legalLink: {
      color: '#6C47FF',
      fontWeight: '800',
    },
    btnShadow: {
      width: '100%',
      shadowColor: '#6C47FF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.32,
      shadowRadius: 10,
      elevation: 5,
      borderRadius: 16,
      marginBottom: 10,
    },
    btnGradient: {
      borderRadius: 16,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 15.5,
      letterSpacing: 0.3,
    },
    footerLink: {
      alignItems: 'center',
      paddingVertical: 8,
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
    trustBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
      paddingVertical: 4,
    },
    trustBadgeText: {
      fontSize: 11.5,
      color: isDarkMode ? '#94A3B8' : '#64748B',
      fontWeight: '600',
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
