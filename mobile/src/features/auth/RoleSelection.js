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
  MessageSquare,
  Smartphone,
  ShieldCheck,
  X,
  Check,
  ArrowRight,
} from 'lucide-react-native';
import api, { getApiErrorMessage } from '../../services/api';

const { width: SW, height: SH } = Dimensions.get('window');

const ROLE_OPTIONS = [
  { id: 'CUSTOMER', label: 'Customer', icon: User, tag: 'Book Services', color: '#6C47FF', bg: 'rgba(108,71,255,0.13)' },
  { id: 'WORKER', label: 'Worker', icon: Wrench, tag: 'Earn & Work', color: '#10B981', bg: 'rgba(16,185,129,0.13)' },
  { id: 'SHOP', label: 'Shop', icon: Store, tag: 'Sell Catalog', color: '#F59E0B', bg: 'rgba(245,158,11,0.13)' },
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
          otpMethod,
          fullName: fullName.trim(),
        });
      }
    } catch (error) {
      showAlert('Error', getApiErrorMessage(error, 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const topPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
  const bottomPad = Math.max(insets.bottom, 16);

  const bg = isDarkMode ? '#0C0E1A' : '#F0F2FF';
  const cardBg = isDarkMode ? '#13172A' : '#FFFFFF';
  const border = isDarkMode ? '#1E2540' : '#E4E8FF';
  const textMain = isDarkMode ? '#F1F2FF' : '#111827';
  const textSub = isDarkMode ? '#7B83B0' : '#6B7280';
  const inputBg = isDarkMode ? '#0A0D1C' : '#F8F9FF';

  const canSubmit = acceptedLegal && phoneNumber.length === 10 && fullName.trim().length >= 2 && !loading;

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Purple gradient hero top section */}
      <LinearGradient
        colors={['#5B2FD4', '#7C47FF', '#9B6BFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: topPad + 28 }]}
      >
        {/* Brand */}
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={styles.brandName}>Kwick<Text style={{ color: '#FFD580' }}>ly</Text></Text>
        </View>
        <Text style={styles.heroTitle}>Create Account</Text>
        <Text style={styles.heroSub}>Join thousands who trust Kwickly daily</Text>

        {/* Role Tabs inside hero */}
        <View style={styles.roleTabs}>
          {ROLE_OPTIONS.map((r) => {
            const Icon = r.icon;
            const active = selectedRole === r.id;
            return (
              <TouchableOpacity
                key={r.id}
                style={[styles.roleTab, active && { backgroundColor: 'rgba(255,255,255,0.22)', borderColor: 'rgba(255,255,255,0.5)' }]}
                onPress={() => { setSelectedRole(r.id); Keyboard.dismiss(); }}
                activeOpacity={0.75}
              >
                <Icon size={16} color={active ? '#FFFFFF' : 'rgba(255,255,255,0.55)'} />
                <Text style={[styles.roleTabLabel, { color: active ? '#FFFFFF' : 'rgba(255,255,255,0.55)' }]}>{r.label}</Text>
                {active && <View style={styles.roleTabDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      {/* White/Dark card body */}
      <View style={[styles.formArea, { backgroundColor: cardBg, paddingBottom: bottomPad + 8 }]}>

        {/* Full Name */}
        <Text style={[styles.label, { color: textSub }]}>Full Name</Text>
        <View style={[
          styles.inputRow,
          { backgroundColor: inputBg, borderColor: focusedInput === 'name' ? '#7C47FF' : border },
          focusedInput === 'name' && styles.inputFocused,
        ]}>
          <User size={16} color={focusedInput === 'name' ? '#7C47FF' : textSub} style={{ marginRight: 10 }} />
          <TextInput
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
        </View>

        {/* Mobile Number */}
        <Text style={[styles.label, { color: textSub, marginTop: 14 }]}>Mobile Number</Text>
        <View style={[
          styles.inputRow,
          { backgroundColor: inputBg, borderColor: focusedInput === 'phone' ? '#7C47FF' : (validatePhone(phoneNumber) ? '#10B981' : border) },
          focusedInput === 'phone' && styles.inputFocused,
        ]}>
          <Text style={[styles.prefix, { color: textMain, borderRightColor: border }]}>🇮🇳 +91</Text>
          <TextInput
            ref={phoneInputRef}
            style={[styles.inputText, { color: textMain }]}
            placeholder="10-digit number"
            placeholderTextColor={textSub}
            keyboardType="number-pad"
            maxLength={10}
            value={phoneNumber}
            onChangeText={(t) => {
              const c = t.replace(/\D/g, '').slice(0, 10);
              setPhoneNumber(c);
              if (c.length === 10 && validatePhone(c) && fullName.trim().length >= 2) Keyboard.dismiss();
            }}
            onFocus={() => setFocusedInput('phone')}
            onBlur={() => setFocusedInput(null)}
            returnKeyType="done"
            onSubmitEditing={handlePhoneSubmit}
          />
          {validatePhone(phoneNumber) ? (
            <CheckCircle2 size={18} color="#10B981" />
          ) : phoneNumber.length > 0 ? (
            <TouchableOpacity onPress={() => setPhoneNumber('')}>
              <X size={16} color={textSub} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* OTP Via */}
        <Text style={[styles.label, { color: textSub, marginTop: 14 }]}>Receive OTP Via</Text>
        <View style={styles.otpRow}>
          {[
            { id: 'SMS', Icon: MessageSquare, color: '#7C47FF', label: 'SMS', sub: 'Standard text' },
            { id: 'WHATSAPP', Icon: Smartphone, color: '#10B981', label: 'WhatsApp', sub: 'Instant message' },
          ].map(m => {
            const active = otpMethod === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.otpCard,
                  { backgroundColor: active ? (isDarkMode ? 'rgba(124,71,255,0.15)' : '#F0EEFF') : inputBg, borderColor: active ? m.color : border },
                ]}
                onPress={() => setOtpMethod(m.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.otpIcon, { backgroundColor: active ? m.color : (isDarkMode ? '#1E2540' : '#F0F2FF') }]}>
                  <m.Icon size={15} color={active ? '#FFF' : textSub} />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.otpLabel, { color: active ? m.color : textMain }]}>{m.label}</Text>
                  <Text style={[styles.otpSub, { color: textSub }]}>{m.sub}</Text>
                </View>
                <View style={[styles.radioOuter, { borderColor: active ? m.color : border }]}>
                  {active && <View style={[styles.radioInner, { backgroundColor: m.color }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Terms */}
        <TouchableOpacity style={styles.termsRow} onPress={() => setAcceptedLegal(!acceptedLegal)} activeOpacity={0.8}>
          <View style={[styles.checkbox, { backgroundColor: acceptedLegal ? '#7C47FF' : 'transparent', borderColor: acceptedLegal ? '#7C47FF' : border }]}>
            {acceptedLegal && <Check size={12} color="#FFF" strokeWidth={3} />}
          </View>
          <Text style={[styles.termsText, { color: textSub }]}>
            I agree to the{' '}
            <Text style={styles.termsLink} onPress={() => openLegalModal('terms')}>Terms of Service</Text>
            {' '}&{' '}
            <Text style={styles.termsLink} onPress={() => openLegalModal('privacy')}>Privacy Policy</Text>
          </Text>
        </TouchableOpacity>

        {/* CTA */}
        <TouchableOpacity
          onPress={handlePhoneSubmit}
          disabled={!canSubmit}
          activeOpacity={0.88}
          style={{ opacity: canSubmit ? 1 : 0.55, marginTop: 18 }}
        >
          <LinearGradient
            colors={['#6334E8', '#7C47FF']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
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
        <View style={styles.footer}>
          <TouchableOpacity onPress={() => navigation.navigate('Login', { role: selectedRole })}>
            <Text style={[styles.footerText, { color: textSub }]}>
              Already registered? <Text style={styles.footerLink}>Sign In</Text>
            </Text>
          </TouchableOpacity>
          <View style={styles.secureRow}>
            <ShieldCheck size={13} color="#10B981" />
            <Text style={[styles.secureText, { color: textSub }]}> 256-bit encrypted & 100% secure</Text>
          </View>
        </View>
      </View>

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={() => setAlertConfig(p => ({ ...p, visible: false }))}
      />

      {/* Legal Modal */}
      <Modal visible={legalModalVisible} animationType="slide" transparent={false} onRequestClose={() => setLegalModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: cardBg, paddingTop: topPad }}>
          <View style={[styles.modalHeader, { borderBottomColor: border }]}>
            <Text style={[styles.modalTitle, { color: textMain }]}>{legalModalTitle}</Text>
            <TouchableOpacity onPress={() => setLegalModalVisible(false)}>
              <Text style={styles.termsLink}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={{ fontSize: 14, color: textMain, lineHeight: 22 }}>{legalModalContent}</Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  /* Hero */
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  brandDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFD580', marginRight: 8 },
  brandName: { fontSize: 20, fontWeight: '900', color: '#FFF', letterSpacing: -0.3 },
  heroTitle: { fontSize: 28, fontWeight: '900', color: '#FFF', letterSpacing: -0.5, marginBottom: 4 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginBottom: 18 },
  roleTabs: { flexDirection: 'row', gap: 8 },
  roleTab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    gap: 4,
    position: 'relative',
  },
  roleTabLabel: { fontSize: 12, fontWeight: '700' },
  roleTabDot: {
    position: 'absolute', top: 5, right: 5,
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFD580',
  },
  /* Form */
  formArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6, letterSpacing: 0.2 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    height: 50,
    paddingHorizontal: 12,
  },
  inputFocused: {
    shadowColor: '#7C47FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  inputText: { flex: 1, fontSize: 15, fontWeight: '600', padding: 0 },
  prefix: { fontSize: 14, fontWeight: '800', marginRight: 10, paddingRight: 10, borderRightWidth: 1 },
  /* OTP */
  otpRow: { flexDirection: 'row', gap: 10 },
  otpCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  otpIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  otpLabel: { fontSize: 13, fontWeight: '800' },
  otpSub: { fontSize: 10.5, marginTop: 1 },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 9, height: 9, borderRadius: 4.5 },
  /* Terms */
  termsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  termsText: { fontSize: 12, flex: 1, lineHeight: 17 },
  termsLink: { color: '#7C47FF', fontWeight: '800' },
  /* CTA */
  ctaBtn: {
    borderRadius: 16,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaText: { color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 },
  /* Footer */
  footer: { alignItems: 'center', marginTop: 14, gap: 6 },
  footerText: { fontSize: 13 },
  footerLink: { color: '#7C47FF', fontWeight: '800' },
  secureRow: { flexDirection: 'row', alignItems: 'center' },
  secureText: { fontSize: 11.5 },
  /* Modal */
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
});

export default RoleSelection;
