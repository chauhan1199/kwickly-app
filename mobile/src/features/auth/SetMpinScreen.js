import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Keyboard,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';
import {
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  X,
  User,
  Store,
  Wrench,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import api, { getApiErrorMessage } from '../../services/api';
import CustomAlert from '../../components/ui/CustomAlert';

const { width: SW } = Dimensions.get('window');

const PURPLE = '#6C47FF';
const PURPLE_LIGHT = '#EEE8FF';

const ROLE_META = {
  CUSTOMER: { label: 'Customer', icon: User, color: PURPLE, bg: PURPLE_LIGHT },
  WORKER: { label: 'Worker / Pro', icon: Wrench, color: '#10B981', bg: '#D1FAE5' },
  SHOP: { label: 'Shop Owner', icon: Store, color: '#F59E0B', bg: '#FEF3C7' },
};

const SetMpinScreen = ({ navigation, route }) => {
  const { phone = '', role = 'CUSTOMER', name = 'User', token = null, user = null } = route.params || {};
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [mpin, setMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [showMpin, setShowMpin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' });

  const confirmRef = useRef(null);

  const topPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16);

  const normalizedRole = (role || 'CUSTOMER').toUpperCase();
  const roleMeta = ROLE_META[normalizedRole] || ROLE_META.CUSTOMER;
  const RoleIcon = roleMeta.icon;

  const isMatched = mpin.length === 4 && confirmMpin.length === 4 && mpin === confirmMpin;
  const isMismatched = mpin.length === 4 && confirmMpin.length === 4 && mpin !== confirmMpin;

  const showAlert = (title, message, type = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const handleSetMpin = async (pinOverride, confirmOverride) => {
    const activePin = typeof pinOverride === 'string' ? pinOverride : mpin;
    const activeConfirm = typeof confirmOverride === 'string' ? confirmOverride : confirmMpin;

    if (!activePin || activePin.length !== 4 || !/^\d{4}$/.test(activePin)) {
      showAlert('Invalid MPIN', 'Please enter a valid 4-digit numeric MPIN.');
      return;
    }
    if (!activeConfirm || activeConfirm.length !== 4) {
      showAlert('Confirm MPIN', 'Please confirm your 4-digit MPIN.');
      return;
    }
    if (activePin !== activeConfirm) {
      showAlert('Mismatch', 'MPINs do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(
        '/auth/set-mpin',
        { mpin: activePin, password: activePin },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      const finalToken = response.data?.data?.token || token;
      const finalUser = response.data?.data?.user || user;
      await signIn(finalToken, role, finalUser);
    } catch (error) {
      const errMsg = getApiErrorMessage(error, 'Failed to set MPIN. Please try again.');
      showAlert('Error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  const cardBg = isDarkMode ? '#131B2E' : '#FFFFFF';
  const textMain = isDarkMode ? '#F1F5F9' : '#0F172A';
  const textSub = isDarkMode ? '#94A3B8' : '#64748B';
  const border = isDarkMode ? '#1E293B' : '#E2E8F0';
  const inputBg = isDarkMode ? '#0B1120' : '#F8FAFC';

  return (
    <View style={[styles.root, { backgroundColor: isDarkMode ? '#0C0E1A' : '#FFF' }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

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
          {/* ── HERO HEADER (matches HomeScreen) ── */}
          <LinearGradient
            colors={[PURPLE, '#8B6FFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { paddingTop: topPad + 18 }]}
          >
            <View style={styles.blob1} />
            <View style={styles.blob2} />

            {/* Brand */}
            <View style={styles.brandRow}>
              <KwicklyIcon size={38} />
              <Text style={styles.brandName}>Kwick<Text style={{ color: '#FFD580' }}>ly</Text></Text>
            </View>

            {/* Badge Pill */}
            <View style={styles.badgePill}>
              <Sparkles size={13} color="#FFFFFF" />
              <Text style={styles.badgePillText}>Almost Done</Text>
            </View>

            <Text style={styles.heroTitle}>Create 4-Digit MPIN</Text>
            <Text style={styles.heroSub}>
              Use this secure MPIN to sign in quickly anytime
            </Text>
          </LinearGradient>

      {/* ── FORM CARD ── */}
      <View style={[styles.card, { backgroundColor: cardBg, paddingBottom: bottomPad + 16 }]}>
        {/* User Info Chip */}
        <View style={[styles.userChip, { backgroundColor: inputBg, borderColor: border }]}>
          <View style={[styles.roleIconCircle, { backgroundColor: roleMeta.bg }]}>
            <RoleIcon size={16} color={roleMeta.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: textMain }]} numberOfLines={1}>
              {name || 'User'}
            </Text>
            <Text style={[styles.userPhone, { color: textSub }]}>
              +91 {phone} · {roleMeta.label}
            </Text>
          </View>
          <View style={styles.verifiedBadge}>
            <ShieldCheck size={13} color="#10B981" />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        </View>

        {/* MPIN Input */}
        <View style={styles.fieldHeader}>
          <Text style={[styles.label, { color: textSub }]}>New 4-Digit MPIN</Text>
          <TouchableOpacity onPress={() => setShowMpin(!showMpin)} style={styles.toggleRow}>
            {showMpin ? <EyeOff size={14} color={PURPLE} /> : <Eye size={14} color={PURPLE} />}
            <Text style={styles.toggleText}>{showMpin ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>
        <View
          style={[
            styles.inputWrap,
            { backgroundColor: inputBg, borderColor: focusedInput === 'mpin' ? PURPLE : border },
            focusedInput === 'mpin' && styles.inputFocusShadow,
          ]}
        >
          <Lock size={16} color={focusedInput === 'mpin' ? PURPLE : textSub} style={{ marginRight: 10 }} />
          <TextInput
            style={[
              styles.inputText,
              {
                color: textMain,
                letterSpacing: mpin.length > 0 ? (showMpin ? 6 : 10) : 0,
                fontWeight: '800',
              },
            ]}
            placeholder="Enter 4-digit MPIN"
            placeholderTextColor={textSub}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry={!showMpin}
            value={mpin}
            onChangeText={(t) => {
              const cleaned = t.replace(/\D/g, '').slice(0, 4);
              setMpin(cleaned);
              if (cleaned.length === 4) confirmRef.current?.focus();
            }}
            onFocus={() => setFocusedInput('mpin')}
            onBlur={() => setFocusedInput(null)}
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
          {mpin.length === 4 && <CheckCircle2 size={18} color="#10B981" />}
        </View>

        {/* Confirm MPIN Input */}
        <View style={[styles.fieldHeader, { marginTop: 14 }]}>
          <Text style={[styles.label, { color: textSub }]}>Confirm 4-Digit MPIN</Text>
          {isMatched && (
            <View style={styles.matchTag}>
              <CheckCircle2 size={12} color="#10B981" />
              <Text style={styles.matchTagText}>Matched</Text>
            </View>
          )}
          {isMismatched && (
            <View style={styles.mismatchTag}>
              <X size={12} color="#EF4444" />
              <Text style={styles.mismatchTagText}>Mismatch</Text>
            </View>
          )}
        </View>
        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: inputBg,
              borderColor: isMatched ? '#10B981' : isMismatched ? '#EF4444' : focusedInput === 'confirm' ? PURPLE : border,
            },
            focusedInput === 'confirm' && styles.inputFocusShadow,
          ]}
        >
          <ShieldCheck size={16} color={isMatched ? '#10B981' : focusedInput === 'confirm' ? PURPLE : textSub} style={{ marginRight: 10 }} />
          <TextInput
            ref={confirmRef}
            style={[
              styles.inputText,
              {
                color: textMain,
                letterSpacing: confirmMpin.length > 0 ? (showMpin ? 6 : 10) : 0,
                fontWeight: '800',
              },
            ]}
            placeholder="Re-enter 4-digit MPIN"
            placeholderTextColor={textSub}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry={!showMpin}
            value={confirmMpin}
            onChangeText={(t) => {
              const cleaned = t.replace(/\D/g, '').slice(0, 4);
              setConfirmMpin(cleaned);
              if (cleaned.length === 4 && mpin.length === 4 && cleaned === mpin) {
                Keyboard.dismiss();
                handleSetMpin(mpin, cleaned);
              }
            }}
            onFocus={() => setFocusedInput('confirm')}
            onBlur={() => setFocusedInput(null)}
            returnKeyType="done"
            onSubmitEditing={() => handleSetMpin(mpin, confirmMpin)}
          />
          {isMatched && <CheckCircle2 size={18} color="#10B981" />}
        </View>

        {/* Security hint */}
        <View style={styles.hintBox}>
          <Text style={styles.hintIcon}>💡</Text>
          <Text style={[styles.hintText, { color: textSub }]}>
            Never share your MPIN. Avoid simple sequences like 1234 or 0000.
          </Text>
        </View>

        <View style={{ flex: 1 }} />

        {/* CTA Button */}
        <TouchableOpacity
          style={{ opacity: (isMatched && !loading) ? 1 : 0.5 }}
          onPress={() => handleSetMpin(mpin, confirmMpin)}
          disabled={!isMatched || loading}
          activeOpacity={0.88}
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
              <Text style={styles.ctaText}>Complete & Sign In</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Security trust badge */}
        <View style={styles.secureRow}>
          <ShieldCheck size={13} color="#10B981" />
          <Text style={[styles.secureText, { color: textSub }]}> Bank-grade 256-bit encryption • 100% Secure</Text>
        </View>
      </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={() => setAlertConfig(p => ({ ...p, visible: false }))}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1 },
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
  hero: {
    paddingHorizontal: 22,
    paddingBottom: 28,
    position: 'relative',
    overflow: 'hidden',
  },
  blob1: {
    position: 'absolute',
    width: SW * 0.55,
    height: SW * 0.55,
    borderRadius: SW * 0.28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -SW * 0.15,
    right: -SW * 0.1,
  },
  blob2: {
    position: 'absolute',
    width: SW * 0.4,
    height: SW * 0.4,
    borderRadius: SW * 0.2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: 5,
    left: -SW * 0.1,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
    gap: 6,
  },
  badgePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -12,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10,
  },
  roleIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 14,
    fontWeight: '800',
  },
  userPhone: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  verifiedText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toggleText: {
    color: PURPLE,
    fontSize: 12,
    fontWeight: '700',
  },
  matchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  matchTagText: {
    color: '#10B981',
    fontSize: 11.5,
    fontWeight: '700',
  },
  mismatchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  mismatchTagText: {
    color: '#EF4444',
    fontSize: 11.5,
    fontWeight: '700',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  inputFocusShadow: {
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 71, 255, 0.06)',
    padding: 10,
    borderRadius: 12,
    marginTop: 14,
    gap: 8,
  },
  hintIcon: {
    fontSize: 14,
  },
  hintText: {
    fontSize: 11.5,
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  ctaBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secureText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default SetMpinScreen;
