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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomAlert from '../../components/ui/CustomAlert';
import { useTheme } from '../../context/ThemeContext';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';
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
} from 'lucide-react-native';
import api, { getApiErrorMessage } from '../../services/api';

const { width: SW } = Dimensions.get('window');

// ── Design tokens (matches HomeScreen) ──
const PURPLE = '#6C47FF';
const PURPLE_LIGHT = '#EEE8FF';
const BG = '#FFFFFF';

const ROLE_OPTIONS = [
  { id: 'CUSTOMER', label: 'Customer', icon: User, color: PURPLE, bg: PURPLE_LIGHT },
  { id: 'WORKER', label: 'Worker', icon: Wrench, color: '#10B981', bg: '#D1FAE5' },
  { id: 'SHOP', label: 'Shop', icon: Store, color: '#F59E0B', bg: '#FEF3C7' },
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

    // Validations
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
      // Step 1: Check if phone already has an account
      let existingAccount = false;
      try {
        const statusRes = await api.post('/auth/check-status', { phone: phoneNumber, role: selectedRole });
        const statusData = statusRes.data?.data || {};
        // If account exists with MPIN → inform user and redirect to login
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
        existingAccount = !!statusData.exists;
      } catch (checkErr) {
        console.log('[RoleSelection] check-status error (non-fatal):', checkErr?.message);
      }

      // Step 2: Send OTP for new registration
      await api.post('/auth/send-otp', {
        phone: phoneNumber,
        role: selectedRole,
        method: otpMethod,
      });

      // Step 3: Navigate to OTP verify
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

  const topPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
  const bottomPad = Math.max(insets.bottom, 16);

  const cardBg = isDarkMode ? '#13172A' : BG;
  const border = isDarkMode ? '#2A3050' : '#E8EAFF';
  const textMain = isDarkMode ? '#F1F2FF' : '#1A1A2E';
  const textSub = isDarkMode ? '#7B83B0' : '#64748B';
  const inputBg = isDarkMode ? '#0A0D1C' : '#F8F9FF';
  const heroBg = isDarkMode ? '#0C0E1A' : '#FFFFFF';

  const canSubmit = acceptedLegal && phoneNumber.length === 10 && fullName.trim().length >= 2 && !loading;

  return (
    <View style={[styles.root, { backgroundColor: heroBg }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── HERO (matches HomeScreen brand & purple gradient) ── */}
          <LinearGradient
            colors={[PURPLE, '#8B6FFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { paddingTop: topPad + 18 }]}
          >
            {/* Decorative blobs */}
            <View style={styles.blob1} />
            <View style={styles.blob2} />

            {/* Official Kwickly App Icon & Brand Name (matches HomeScreen) */}
            <View style={styles.brandRow}>
              <KwicklyIcon size={38} />
              <Text style={styles.brandName}>
                Kwick<Text style={{ color: '#FFD580' }}>ly</Text>
              </Text>
            </View>

            <Text style={styles.heroTitle}>Create Account</Text>
            <Text style={styles.heroSub}>Join thousands who trust Kwickly</Text>

            {/* Role pills */}
            <View style={styles.roleTabs}>
              {ROLE_OPTIONS.map((r) => {
                const Icon = r.icon;
                const active = selectedRole === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      styles.roleTab,
                      active && styles.roleTabActive,
                    ]}
                    onPress={() => { setSelectedRole(r.id); Keyboard.dismiss(); }}
                    activeOpacity={0.75}
                  >
                    <Icon size={18} color={active ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} />
                    <Text style={[styles.roleTabLabel, { color: active ? '#FFF' : 'rgba(255,255,255,0.6)' }]}>
                      {r.label}
                    </Text>
                    {active && <View style={styles.roleActiveDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </LinearGradient>

          {/* ── FORM CARD ── */}
          <View style={[styles.card, { backgroundColor: cardBg, paddingBottom: bottomPad + 14 }]}>

            {/* Full Name */}
            <Text style={[styles.label, { color: textSub }]}>Full Name</Text>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => nameInputRef.current?.focus()}
              style={[
                styles.inputWrap,
                { backgroundColor: inputBg, borderColor: focusedInput === 'name' ? PURPLE : border },
                focusedInput === 'name' && styles.inputFocusShadow,
              ]}
            >
              <User size={16} color={focusedInput === 'name' ? PURPLE : textSub} style={{ marginRight: 10 }} />
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

            {/* Mobile Number (tap anywhere on box to focus) */}
            <Text style={[styles.label, { color: textSub, marginTop: 14 }]}>Mobile Number</Text>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => phoneInputRef.current?.focus()}
              style={[
                styles.inputWrap,
                {
                  backgroundColor: inputBg,
                  borderColor: validatePhone(phoneNumber) ? '#10B981' : focusedInput === 'phone' ? PURPLE : border,
                },
                focusedInput === 'phone' && styles.inputFocusShadow,
              ]}
            >
              <View pointerEvents="none" style={styles.prefixBox}>
                <Text style={[styles.prefix, { color: textMain, borderRightColor: border }]}>🇮🇳 +91</Text>
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
                  if (digits.length > 10 && digits.startsWith('91')) {
                    digits = digits.slice(2);
                  } else if (digits.length > 10 && digits.startsWith('0')) {
                    digits = digits.slice(1);
                  }
                  const clean = digits.slice(0, 10);
                  setPhoneNumber(clean);
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

            {/* OTP Method */}
            <Text style={[styles.label, { color: textSub, marginTop: 14 }]}>Receive OTP Via</Text>
            <View style={styles.methodRow}>
              {[
                { id: 'SMS', Icon: MessageSquare, color: PURPLE, label: 'SMS' },
                { id: 'WHATSAPP', Icon: Smartphone, color: '#10B981', label: 'WhatsApp' },
              ].map(m => {
                const active = otpMethod === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.methodCard,
                      {
                        backgroundColor: active ? (isDarkMode ? `${m.color}22` : `${m.color}12`) : inputBg,
                        borderColor: active ? m.color : border,
                      },
                    ]}
                    onPress={() => setOtpMethod(m.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.methodIcon, { backgroundColor: active ? m.color : (isDarkMode ? '#1E2540' : '#F0F2FF') }]}>
                      <m.Icon size={15} color={active ? '#FFF' : textSub} />
                    </View>
                    <Text style={[styles.methodLabel, { color: active ? m.color : textMain }]} numberOfLines={1}>
                      {m.label}
                    </Text>
                    <View style={[styles.radioOuter, { borderColor: active ? m.color : border }]}>
                      {active && <View style={[styles.radioInner, { backgroundColor: m.color }]} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Terms */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setAcceptedLegal(!acceptedLegal)}
              activeOpacity={0.8}
            >
              <View style={[
                styles.checkbox,
                { backgroundColor: acceptedLegal ? PURPLE : 'transparent', borderColor: acceptedLegal ? PURPLE : border },
              ]}>
                {acceptedLegal && <Check size={11} color="#FFF" strokeWidth={3} />}
              </View>
              <Text style={[styles.termsText, { color: textSub }]}>
                I agree to the{' '}
                <Text style={styles.termsLink} onPress={() => openLegalModal('terms')}>
                  Terms of Service
                </Text>
                {' '}&{' '}
                <Text style={styles.termsLink} onPress={() => openLegalModal('privacy')}>
                  Privacy Policy
                </Text>
              </Text>
            </TouchableOpacity>

            {/* Send OTP button */}
            <TouchableOpacity
              onPress={handlePhoneSubmit}
              disabled={!canSubmit}
              activeOpacity={0.88}
              style={{ opacity: canSubmit ? 1 : 0.5, marginTop: 18 }}
            >
              <LinearGradient
                colors={[PURPLE, '#8B6FFF']}
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

            {/* Footer */}
            <View style={styles.footerRow}>
              <TouchableOpacity onPress={() => navigation.navigate('Login', { role: selectedRole })}>
                <Text style={[styles.footerText, { color: textSub }]}>
                  Already registered? <Text style={styles.footerLink}>Sign In</Text>
                </Text>
              </TouchableOpacity>
              <View style={styles.secureRow}>
                <ShieldCheck size={12} color="#10B981" />
                <Text style={[styles.secureText, { color: textSub }]}> 256-bit encrypted & 100% secure</Text>
              </View>
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
      />

      {/* Legal Modal */}
      <Modal
        visible={legalModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setLegalModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: isDarkMode ? '#0B0F19' : '#FFFFFF', paddingTop: insets.top }}>
          <View style={styles.modalHeader}>
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
  root: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  blob1: {
    position: 'absolute', top: -40, right: -40,
    width: 170, height: 170, borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  blob2: {
    position: 'absolute', bottom: -30, left: -40,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.4,
  },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#FFF', letterSpacing: -0.4, marginBottom: 4 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500', marginBottom: 18 },

  // Role tabs
  roleTabs: { flexDirection: 'row', gap: 8 },
  roleTab: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 14, gap: 4,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  roleTabActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.55)',
  },
  roleTabLabel: { fontSize: 12, fontWeight: '700' },
  roleActiveDot: {
    position: 'absolute', top: 5, right: 5,
    width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFD580',
  },

  // Card
  card: {
    flex: 1, paddingHorizontal: 20, paddingTop: 22,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 5,
  },

  // Input
  label: { fontSize: 11.5, fontWeight: '700', marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 14, height: 52, paddingHorizontal: 12,
  },
  inputFocusShadow: {
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 2,
  },
  inputText: {
    flex: 1, fontSize: 16, fontWeight: '700',
    height: '100%', paddingVertical: 0,
  },
  prefixBox: {
    justifyContent: 'center',
  },
  prefix: {
    fontSize: 14, fontWeight: '800',
    marginRight: 10, paddingRight: 10, borderRightWidth: 1,
  },

  // OTP method
  methodRow: { flexDirection: 'row', gap: 10 },
  methodCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 14,
    paddingVertical: 11, paddingHorizontal: 10, gap: 8,
  },
  methodIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  methodLabel: { flex: 1, fontSize: 13, fontWeight: '800' },
  radioOuter: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  radioInner: { width: 9, height: 9, borderRadius: 5 },

  // Terms
  termsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  termsText: { fontSize: 12, flex: 1, lineHeight: 18 },
  termsLink: { color: PURPLE, fontWeight: '800' },

  // CTA
  ctaBtn: {
    height: 52, borderRadius: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  ctaText: { color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 },

  // Footer
  footerRow: { alignItems: 'center', marginTop: 14, gap: 6 },
  footerText: { fontSize: 13 },
  footerLink: { color: PURPLE, fontWeight: '800' },
  secureRow: { flexDirection: 'row', alignItems: 'center' },
  secureText: { fontSize: 11.5 },

  // Modal
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
});

export default RoleSelection;
