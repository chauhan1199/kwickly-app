import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  useWindowDimensions,
  TextInput,
  Image,
  StatusBar,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomAlert from '../../components/ui/CustomAlert';
import { useTheme } from '../../context/ThemeContext';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';
import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';
import { getSafeBottomInset, getSafeTopInset } from '../../utils/safeInsets';
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
  Phone,
  Zap,
} from 'lucide-react-native';
import api, { getApiErrorMessage } from '../../services/api';

const PURPLE = '#6C47FF';
const PURPLE_LIGHT = '#F5F3FF';

const ROLE_OPTIONS = [
  { id: 'CUSTOMER', label: 'Customer', sub: 'Book services', icon: User, color: PURPLE, bg: PURPLE_LIGHT },
  { id: 'WORKER', label: 'Worker', sub: 'Offer services', icon: Wrench, color: '#10B981', bg: '#D1FAE5' },
  { id: 'SHOP', label: 'Shop', sub: 'Grow business', icon: Store, color: '#F59E0B', bg: '#FEF3C7' },
];

const RoleSelection = ({ navigation, route }) => {
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

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

  const safeTopPadding = getSafeTopInset(insets, 14);
  const safeBottomInset = getSafeBottomInset(insets, 8);

  const { height: windowHeight } = useWindowDimensions();
  const isCompactScreen = windowHeight < 840;
  const createFooterAspect = isDarkMode ? (508 / 1376) : (160 / 576);
  const rawCreateFooterHeight = Math.round(Math.min(windowWidth, 600) * createFooterAspect);
  const createFooterHeight = isCompactScreen ? Math.min(rawCreateFooterHeight, 60) : Math.min(rawCreateFooterHeight, 85);

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
              paddingBottom: keyboardVisible ? (keyboardHeight || bottomInset) : safeBottomInset + 16,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
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
              source={
                isDarkMode
                  ? require('../../assets/images/hero_create_account_dark.png')
                  : require('../../assets/images/hero_create_account.png')
              }
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
            <Text style={[styles.fieldLabel, { color: textSub, marginTop: 8 }]}>Full Name</Text>
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
              <User size={17} color={focusedInput === 'name' ? PURPLE : textSub} style={{ marginRight: 8 }} />
              <TextInput
                ref={nameInputRef}
                style={[styles.inputText, { color: textMain }]}
                placeholder="Enter your full name"
                placeholderTextColor={textSub}
                autoCapitalize="words"
                autoCorrect={false}
                value={fullName}
                onChangeText={setFullName}
                onFocus={() => setFocusedInput('name')}
                onBlur={() => setFocusedInput(null)}
                returnKeyType="next"
                onSubmitEditing={() => phoneInputRef.current?.focus()}
              />
              {fullName.trim().length >= 2 && <CheckCircle2 size={18} color="#10B981" />}
            </TouchableOpacity>

            {/* Mobile Number Field */}
            <Text style={[styles.fieldLabel, { color: textSub, marginTop: 8 }]}>Mobile Number</Text>
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
              <View pointerEvents="none" style={styles.prefixWrapper}>
                <Text style={[styles.flagText]}>🇮🇳</Text>
                <Text style={[styles.prefixNumber, { color: textMain }]}>+91</Text>
                <View style={[styles.prefixDivider, { backgroundColor: inputBorder }]} />
              </View>
              <TextInput
                ref={phoneInputRef}
                style={[styles.inputText, { color: textMain }]}
                placeholder="10-digit number"
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
                onFocus={() => setFocusedInput('phone')}
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
            <Text style={[styles.fieldLabel, { color: textSub, marginTop: 8 }]}>Receive OTP Via</Text>
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
                  <MessageSquare size={14} color="#FFF" />
                </View>
                <View style={styles.methodTextBox}>
                  <Text style={[styles.methodTitle, { color: textMain }]} numberOfLines={1}>SMS</Text>
                  <Text style={[styles.methodSub, { color: textSub }]} numberOfLines={1}>Quick SMS</Text>
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
                  <Smartphone size={14} color="#FFF" />
                </View>
                <View style={styles.methodTextBox}>
                  <Text 
                    style={[styles.methodTitle, { color: textMain }]} 
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.85}
                  >
                    WhatsApp
                  </Text>
                  <Text style={[styles.methodSub, { color: textSub }]} numberOfLines={1}>Instant</Text>
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
              style={[styles.btnShadow, { opacity: canSubmit ? 1 : 0.45, marginTop: 10 }]}
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
                    <ArrowRight size={17} color="#FFF" style={{ marginLeft: 6 }} />
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

          {/* Bottom Section */}
          <View style={styles.bottomSection}>
            {/* Trust Bar Row (3 Badges) */}
            <View style={styles.trustBarRow}>
              <View style={styles.trustItem}>
                <View style={[styles.trustIconWrap, { backgroundColor: '#ECFDF5' }]}>
                  <ShieldCheck size={14} color="#10B981" />
                </View>
                <View style={styles.trustTextCol}>
                  <Text style={[styles.trustTitle, { color: textMain }]} numberOfLines={1}>100% Safe</Text>
                  <Text style={[styles.trustSub, { color: textSub }]} numberOfLines={1}>Data Safe</Text>
                </View>
              </View>

              <View style={styles.trustDivider} />

              <View style={styles.trustItem}>
                <View style={[styles.trustIconWrap, { backgroundColor: '#F5F3FF' }]}>
                  <Zap size={14} color="#6C47FF" />
                </View>
                <View style={styles.trustTextCol}>
                  <Text style={[styles.trustTitle, { color: textMain }]} numberOfLines={1}>Instant</Text>
                  <Text style={[styles.trustSub, { color: textSub }]} numberOfLines={1}>Access</Text>
                </View>
              </View>

              <View style={styles.trustDivider} />

              <View style={styles.trustItem}>
                <Text style={{ fontSize: 16 }}>🇮🇳</Text>
                <View style={styles.trustTextCol}>
                  <Text style={[styles.trustTitle, { color: textMain }]} numberOfLines={1}>India App</Text>
                  <Text style={[styles.trustSub, { color: textSub }]} numberOfLines={1}>Trusted App</Text>
                </View>
              </View>
            </View>

            {/* Bottom Road Landscape Illustration */}
            <View 
              style={[
                styles.footerWrap, 
                { 
                  paddingBottom: Math.max(safeBottomInset, 12),
                  backgroundColor: 'transparent',
                }
              ]} 
              pointerEvents="none"
            >
              <Image
                source={
                  isDarkMode
                    ? require('../../assets/images/footer_create_account_dark.png')
                    : require('../../assets/images/footer_create_account.png')
                }
                style={[styles.bottomFooterImg, { height: createFooterHeight }]}
                resizeMode="contain"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
    bottom: 80,
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
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  topNavRow: {
    marginTop: 2,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  headerLayoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 6,
  },
  scriptBadge: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#6C47FF',
    fontStyle: 'italic',
    transform: [{ rotate: '-4deg' }],
    marginBottom: 1,
  },
  headerHeroImg: {
    width: 110,
    height: 75,
  },
  title: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.4,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'left',
    marginTop: 1,
    lineHeight: 15,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  roleTabsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  roleCard: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    position: 'relative',
  },
  roleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
  },
  roleCheckBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#6C47FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  roleCardSub: {
    fontSize: 8.5,
    fontWeight: '500',
    marginTop: 1,
  },
  inputContainer: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
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
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
  },
  prefixWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  flagText: {
    fontSize: 15,
    marginRight: 3,
  },
  prefixNumber: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 6,
  },
  prefixDivider: {
    width: 1,
    height: 18,
    marginRight: 4,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  methodCard: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  methodIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  methodTextBox: {
    flex: 1,
    marginLeft: 6,
    marginRight: 4,
    minWidth: 0,
    justifyContent: 'center',
  },
  methodTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  methodSub: {
    fontSize: 8.5,
    fontWeight: '500',
    marginTop: 1,
  },
  checkCircle: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircle: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
  termsLink: {
    fontWeight: '700',
  },
  btnShadow: {
    width: '100%',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 5,
  },
  ctaBtn: {
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  footerRow: {
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerLink: {
    fontWeight: '800',
  },
  bottomSection: {
    width: '100%',
    marginTop: 8,
  },
  trustBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  trustItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  trustTextCol: {
    flexShrink: 1,
  },
  trustIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustTitle: {
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 13,
  },
  trustSub: {
    fontSize: 8.5,
    fontWeight: '600',
    lineHeight: 11,
  },
  trustDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(150, 150, 150, 0.25)',
    marginHorizontal: 3,
  },
  footerWrap: {
    width: '100%',
    maxWidth: 600,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    alignSelf: 'center',
  },
  bottomFooterImg: {
    width: '100%',
    maxWidth: 600,
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
