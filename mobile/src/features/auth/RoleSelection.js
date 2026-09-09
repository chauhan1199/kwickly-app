import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Platform,
  Modal,
  Keyboard,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomAlert from '../../components/ui/CustomAlert';
import { useTheme } from '../../context/ThemeContext';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';
import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';
import {
  User,
  Wrench,
  Store,
  CheckCircle2,
  MessageSquare,
  Smartphone,
  ShieldCheck,
  X,
  Check,
  ArrowRight,
  Sparkles,
  ChevronLeft,
  Phone,
  Zap,
} from 'lucide-react-native';
import api, { getApiErrorMessage } from '../../services/api';

const { width: SW, height: SH } = Dimensions.get('window');

const PURPLE = '#6C47FF';
const PURPLE_LIGHT = '#F5F3FF';

const ROLE_OPTIONS = [
  { id: 'CUSTOMER', label: 'Customer', sub: 'Find & book services', icon: User, color: PURPLE, bg: PURPLE_LIGHT },
  { id: 'WORKER', label: 'Worker', sub: 'Offer your services', icon: Wrench, color: '#10B981', bg: '#D1FAE5' },
  { id: 'SHOP', label: 'Shop', sub: 'Grow your business', icon: Store, color: '#F59E0B', bg: '#FEF3C7' },
];

const RoleSelection = ({ navigation, route }) => {
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedRole, setSelectedRole] = useState(route?.params?.role || 'CUSTOMER');
  const [phoneNumber, setPhoneNumber] = useState(route?.params?.prefillPhone || '');
  const [fullName, setFullName] = useState('');
  const [otpMethod, setOtpMethod] = useState('SMS');
  const [focusedInput, setFocusedInput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error', onConfirm: null });

  const nameInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const scrollRef = useRef(null);

  const { keyboardVisible, keyboardHeight, bottomInset } = useKeyboardBottomInset(30);

  // Legal Modal
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalModalContent, setLegalModalContent] = useState('');
  const [legalModalTitle, setLegalModalTitle] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(true);
  const [termsText, setTermsText] = useState('');
  const [privacyText, setPrivacyText] = useState('');

  useEffect(() => {
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
    setLegalModalTitle(type === 'terms' ? 'Terms of Service' : 'Privacy Policy');
    setLegalModalContent(type === 'terms' ? termsText : privacyText);
    setLegalModalVisible(true);
  };

  const showAlert = (title, message, type = 'error', onConfirm = null) => {
    setAlertConfig({ visible: true, title, message, type, onConfirm });
  };

  const validatePhone = (num) => /^[6-9]\d{9}$/.test(num);

  const handlePhoneSubmit = async () => {
    Keyboard.dismiss();

    if (!fullName.trim() || fullName.trim().length < 2) {
      showAlert('Missing Name', 'Please enter your full name (at least 2 characters).');
      return;
    }
    if (!validatePhone(phoneNumber)) {
      showAlert('Invalid Number', 'Enter a valid 10-digit mobile number starting with 6–9.');
      return;
    }
    if (!acceptedLegal) {
      showAlert('Terms Required', 'Please agree to the Terms of Service and Privacy Policy.');
      return;
    }

    setLoading(true);
    try {
      try {
        const statusRes = await api.post('/auth/check-status', { phone: phoneNumber, role: selectedRole });
        const statusData = statusRes.data?.data || {};
        if (statusData.exists && (statusData.hasMpin || statusData.hasPassword)) {
          setLoading(false);
          showAlert(
            'Account Already Exists',
            `An account with mobile number +91 ${phoneNumber} is already registered. Please sign in with your MPIN.`,
            'info',
            () => {
              navigation.navigate('Login', {
                prefillPhone: phoneNumber,
                role: selectedRole,
                defaultMode: 'MPIN',
              });
            }
          );
          return;
        }
      } catch (checkErr) {
        console.log('[RoleSelection] check-status error (non-fatal):', checkErr?.message);
      }

      await api.post('/auth/send-otp', {
        phone: phoneNumber,
        role: selectedRole,
        method: otpMethod,
      });

      navigation.navigate('OTPVerify', {
        phone: phoneNumber,
        role: selectedRole,
        otpMethod,
        fullName: fullName.trim(),
      });
    } catch (error) {
      const errMsg = getApiErrorMessage(error, 'Could not send OTP. Please try again.');
      showAlert('Error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const safeTopPadding = Math.max(insets.top, statusBarHeight) + 12;
  const safeBottomPadding = Math.max(insets.bottom, 16);

  const cardBg = isDarkMode ? '#131B2E' : '#FFFFFF';
  const cardBorder = isDarkMode ? '#1E293B' : '#EDF0F7';
  const textMain = isDarkMode ? '#F8FAFC' : '#0F172A';
  const textSub = isDarkMode ? '#94A3B8' : '#64748B';
  const inputBg = isDarkMode ? '#0B1120' : '#F8FAFC';
  const inputBorder = isDarkMode ? '#1E293B' : '#E2E8F0';

  const canSubmit = acceptedLegal && phoneNumber.length === 10 && fullName.trim().length >= 2 && !loading;

  return (
    <View style={[styles.root, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8F9FD' }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Ambient Gradient Canvas (Identical to HomeScreen) */}
      <LinearGradient
        colors={
          isDarkMode
            ? ['#0B0F19', '#111827', '#0B0F19']
            : ['#FFFFFF', '#F6F8FC', '#EEF2FF', '#FFFFFF']
        }
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient Glowing Orbs */}
      <View pointerEvents="none" style={styles.bgOrbTopLeft}>
        <LinearGradient colors={['#8B5CF6', '#6C47FF']} style={StyleSheet.absoluteFill} />
      </View>
      <View pointerEvents="none" style={styles.bgOrbBottomRight}>
        <LinearGradient colors={['#3B82F6', '#6C47FF']} style={StyleSheet.absoluteFill} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: safeTopPadding,
              paddingBottom: safeBottomPadding + bottomInset,
              justifyContent: keyboardVisible ? 'flex-start' : 'center',
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Top Bar with Back Button */}
          <View style={styles.topNavRow}>
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: cardBg, borderColor: cardBorder }]}
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Welcome'))}
              activeOpacity={0.8}
            >
              <ChevronLeft size={20} color={textMain} />
            </TouchableOpacity>
          </View>

          {/* Top Header Row with Left Headline & Right 3D Art */}
          <View style={styles.headerLayoutRow}>
            <View style={styles.headerTextCol}>
              <Text style={styles.scriptBadge}>Join Our Growing Community</Text>
              <Text style={[styles.title, { color: textMain }]}>
                Create <Text style={{ color: '#6C47FF' }}>Your Account</Text>
              </Text>
              <Text style={[styles.subtitle, { color: textSub }]}>
                Take the next step. A few details and you're all set!
              </Text>
            </View>
            <Image
              source={require('../../assets/images/hero_create_account.png')}
              style={styles.headerHeroImg}
              resizeMode="contain"
            />
          </View>

          {/* Floating Form Card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            
            {/* Registering As */}
            <Text style={[styles.fieldLabel, { color: textSub }]}>Registering As</Text>
            <View style={styles.roleTabsContainer}>
              {ROLE_OPTIONS.map((r) => {
                const Icon = r.icon;
                const active = selectedRole === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      styles.roleCard,
                      {
                        backgroundColor: active ? (isDarkMode ? '#1E1B4B' : '#F5F3FF') : inputBg,
                        borderColor: active ? PURPLE : inputBorder,
                      },
                    ]}
                    onPress={() => { setSelectedRole(r.id); Keyboard.dismiss(); }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.roleTopRow}>
                      <Icon size={18} color={active ? PURPLE : textSub} />
                      {active && (
                        <View style={styles.roleCheckBadge}>
                          <Check size={9} color="#FFF" strokeWidth={3} />
                        </View>
                      )}
                    </View>
                    <Text style={[styles.roleCardLabel, { color: active ? PURPLE : textMain }]}>
                      {r.label}
                    </Text>
                    <Text style={[styles.roleCardSub, { color: textSub }]} numberOfLines={1}>
                      {r.sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Full Name Field */}
            <Text style={[styles.fieldLabel, { color: textSub, marginTop: 14 }]}>Full Name</Text>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => nameInputRef.current?.focus()}
              style={[
                styles.inputContainer,
                {
                  backgroundColor: inputBg,
                  borderColor: focusedInput === 'name' ? PURPLE : inputBorder,
                },
                focusedInput === 'name' && styles.inputFocusGlow,
              ]}
            >
              <User size={18} color={focusedInput === 'name' ? PURPLE : textSub} style={{ marginRight: 8 }} />
              <TextInput
                ref={nameInputRef}
                style={[styles.inputText, { color: textMain }]}
                placeholder="Enter your full name"
                placeholderTextColor={textSub}
                autoCapitalize="words"
                autoCorrect={false}
                value={fullName}
                onChangeText={setFullName}
                onFocus={() => {
                  setFocusedInput('name');
                  setTimeout(() => scrollRef.current?.scrollTo({ y: 90, animated: true }), 100);
                }}
                onBlur={() => setFocusedInput(null)}
                returnKeyType="next"
                onSubmitEditing={() => phoneInputRef.current?.focus()}
              />
              {fullName.trim().length >= 2 && <CheckCircle2 size={18} color="#10B981" />}
            </TouchableOpacity>

            {/* Mobile Number Field */}
            <Text style={[styles.fieldLabel, { color: textSub, marginTop: 14 }]}>Mobile Number</Text>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => phoneInputRef.current?.focus()}
              style={[
                styles.inputContainer,
                {
                  backgroundColor: inputBg,
                  borderColor: validatePhone(phoneNumber) ? '#10B981' : focusedInput === 'phone' ? PURPLE : inputBorder,
                },
                focusedInput === 'phone' && styles.inputFocusGlow,
              ]}
            >
              <Phone size={17} color={focusedInput === 'phone' ? PURPLE : textSub} style={{ marginRight: 8 }} />
              <View pointerEvents="none" style={styles.prefixWrapper}>
                <Text style={[styles.flagText]}>🇮🇳</Text>
                <Text style={[styles.prefixNumber, { color: textMain }]}>+91</Text>
                <View style={[styles.prefixDivider, { backgroundColor: inputBorder }]} />
              </View>
              <TextInput
                ref={phoneInputRef}
                style={[styles.inputText, { color: textMain }]}
                placeholder="Enter 10-digit number"
                placeholderTextColor={textSub}
                keyboardType="phone-pad"
                maxLength={15}
                editable={!loading}
                value={phoneNumber}
                onChangeText={(t) => {
                  let digits = (t || '').replace(/\D/g, '');
                  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
                  else if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
                  setPhoneNumber(digits.slice(0, 10));
                }}
                onFocus={() => {
                  setFocusedInput('phone');
                  setTimeout(() => scrollRef.current?.scrollTo({ y: 160, animated: true }), 100);
                }}
                onBlur={() => setFocusedInput(null)}
                returnKeyType="done"
                onSubmitEditing={handlePhoneSubmit}
              />
              {validatePhone(phoneNumber) ? (
                <CheckCircle2 size={18} color="#10B981" />
              ) : phoneNumber.length > 0 ? (
                <TouchableOpacity onPress={() => setPhoneNumber('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={16} color={textSub} />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>

            {/* OTP Delivery Method Selection */}
            <Text style={[styles.fieldLabel, { color: textSub, marginTop: 14 }]}>Receive OTP Via</Text>
            <View style={styles.methodRow}>
              <TouchableOpacity
                style={[
                  styles.methodCard,
                  {
                    backgroundColor: otpMethod === 'SMS' ? (isDarkMode ? '#1E1B4B' : '#F5F3FF') : inputBg,
                    borderColor: otpMethod === 'SMS' ? PURPLE : inputBorder,
                  },
                ]}
                onPress={() => setOtpMethod('SMS')}
                activeOpacity={0.8}
              >
                <View style={[styles.methodIconBox, { backgroundColor: PURPLE }]}>
                  <MessageSquare size={16} color="#FFF" />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.methodTitle, { color: textMain }]}>SMS</Text>
                  <Text style={[styles.methodSub, { color: textSub }]}>Standard text message</Text>
                </View>
                <View style={[styles.checkCircle, { backgroundColor: otpMethod === 'SMS' ? PURPLE : 'transparent', borderColor: otpMethod === 'SMS' ? PURPLE : inputBorder }]}>
                  {otpMethod === 'SMS' && <Check size={10} color="#FFF" strokeWidth={3} />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.methodCard,
                  {
                    backgroundColor: otpMethod === 'WHATSAPP' ? (isDarkMode ? 'rgba(16, 185, 129, 0.12)' : '#F0FDF4') : inputBg,
                    borderColor: otpMethod === 'WHATSAPP' ? '#10B981' : inputBorder,
                  },
                ]}
                onPress={() => setOtpMethod('WHATSAPP')}
                activeOpacity={0.8}
              >
                <View style={[styles.methodIconBox, { backgroundColor: '#10B981' }]}>
                  <Smartphone size={16} color="#FFF" />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.methodTitle, { color: textMain }]}>WhatsApp</Text>
                  <Text style={[styles.methodSub, { color: textSub }]}>Instant message</Text>
                </View>
                <View style={[styles.radioCircle, { borderColor: otpMethod === 'WHATSAPP' ? '#10B981' : inputBorder }]}>
                  {otpMethod === 'WHATSAPP' && <View style={[styles.radioDot, { backgroundColor: '#10B981' }]} />}
                </View>
              </TouchableOpacity>
            </View>

            {/* Terms of Service & Privacy Policy Checkbox */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setAcceptedLegal(!acceptedLegal)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: acceptedLegal ? PURPLE : 'transparent',
                    borderColor: acceptedLegal ? PURPLE : inputBorder,
                  },
                ]}
              >
                {acceptedLegal && <Check size={11} color="#FFF" strokeWidth={3} />}
              </View>
              <Text style={[styles.termsText, { color: textSub }]}>
                I agree to the{' '}
                <Text style={[styles.termsLink, { color: PURPLE }]} onPress={() => openLegalModal('terms')}>
                  Terms of Service
                </Text>
                {' '}&{' '}
                <Text style={[styles.termsLink, { color: PURPLE }]} onPress={() => openLegalModal('privacy')}>
                  Privacy Policy
                </Text>
              </Text>
            </TouchableOpacity>

            {/* Primary Action Button (HomeScreen CTA standard) */}
            <TouchableOpacity
              onPress={handlePhoneSubmit}
              disabled={!canSubmit}
              activeOpacity={0.88}
              style={[styles.btnShadow, { opacity: canSubmit ? 1 : 0.45, marginTop: 18 }]}
            >
              <LinearGradient
                colors={[PURPLE, '#582BE8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaBtn}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.ctaText}>Send OTP</Text>
                    <ArrowRight size={18} color="#FFF" style={{ marginLeft: 8 }} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Bottom Navigation Link */}
            <View style={styles.footerRow}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Login', { role: selectedRole })}
                activeOpacity={0.75}
              >
                <Text style={[styles.footerText, { color: textSub }]}>
                  Already registered? <Text style={[styles.footerLink, { color: PURPLE }]}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Trust Bar Row (3 Badges) */}
          <View style={styles.trustBarRow}>
            <View style={styles.trustItem}>
              <View style={[styles.trustIconWrap, { backgroundColor: '#ECFDF5' }]}>
                <ShieldCheck size={16} color="#10B981" />
              </View>
              <View>
                <Text style={[styles.trustTitle, { color: textMain }]}>100% Secure</Text>
                <Text style={[styles.trustSub, { color: textSub }]}>Your data is safe</Text>
              </View>
            </View>

            <View style={styles.trustDivider} />

            <View style={styles.trustItem}>
              <View style={[styles.trustIconWrap, { backgroundColor: '#F5F3FF' }]}>
                <Zap size={16} color="#6C47FF" />
              </View>
              <View>
                <Text style={[styles.trustTitle, { color: textMain }]}>Quick & Easy</Text>
                <Text style={[styles.trustSub, { color: textSub }]}>Get started in minutes</Text>
              </View>
            </View>

            <View style={styles.trustDivider} />

            <View style={styles.trustItem}>
              <Text style={{ fontSize: 18 }}>🇮🇳</Text>
              <View>
                <Text style={[styles.trustTitle, { color: textMain }]}>Made in India</Text>
                <Text style={[styles.trustSub, { color: textSub }]}>For a better tomorrow</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Road Landscape Illustration */}
      <Image
        source={require('../../assets/images/footer_create_account.png')}
        style={styles.bottomFooterImg}
        resizeMode="cover"
        pointerEvents="none"
      />

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={() => {
          const cb = alertConfig.onConfirm;
          setAlertConfig(p => ({ ...p, visible: false, onConfirm: null }));
          if (cb) cb();
        }}
        onRequestClose={() => {
          const cb = alertConfig.onConfirm;
          setAlertConfig(p => ({ ...p, visible: false, onConfirm: null }));
          if (cb) cb();
        }}
      />

      {/* Legal Modal */}
      <Modal
        visible={legalModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setLegalModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: isDarkMode ? '#0B0F19' : '#FFFFFF', paddingTop: insets.top }}>
          <View style={[styles.modalHeader, { borderBottomColor: inputBorder }]}>
            <Text style={[styles.modalTitle, { color: textMain }]}>{legalModalTitle}</Text>
            <TouchableOpacity onPress={() => setLegalModalVisible(false)} style={{ padding: 8 }}>
              <X size={20} color={textMain} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={{ fontSize: 14, color: textSub, lineHeight: 22 }}>
              {legalModalContent}
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  bgOrbTopLeft: {
    position: 'absolute',
    top: -50,
    left: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.14,
    overflow: 'hidden',
  },
  bgOrbBottomRight: {
    position: 'absolute',
    bottom: SH * 0.10,
    right: -70,
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.12,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  topNavRow: {
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  headerLayoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 8,
  },
  scriptBadge: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6C47FF',
    fontStyle: 'italic',
    transform: [{ rotate: '-4deg' }],
    marginBottom: 4,
  },
  headerHeroImg: {
    width: SW * 0.40,
    height: 120,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    textAlign: 'left',
    marginTop: 4,
    lineHeight: 17,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 22,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  roleTabsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  roleCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    position: 'relative',
  },
  roleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 6,
  },
  roleCheckBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#6C47FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  roleCardSub: {
    fontSize: 9.5,
    fontWeight: '500',
    marginTop: 2,
  },
  inputContainer: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  inputFocusGlow: {
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 0,
  },
  prefixWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  flagText: {
    fontSize: 16,
    marginRight: 4,
  },
  prefixNumber: {
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },
  prefixDivider: {
    width: 1,
    height: 22,
    marginRight: 4,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  methodCard: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  methodIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  methodSub: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 1,
  },
  checkCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  termsLink: {
    fontWeight: '700',
  },
  btnShadow: {
    width: '100%',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  footerRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footerLink: {
    fontWeight: '800',
  },
  trustBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustTitle: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  trustSub: {
    fontSize: 8.5,
    fontWeight: '500',
  },
  trustDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(150, 150, 150, 0.25)',
  },
  bottomFooterImg: {
    width: SW,
    height: 120,
    marginTop: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
});

export default RoleSelection;
