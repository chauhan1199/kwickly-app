import React, { useState, useRef, useEffect } from 'react';
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
  Pressable,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';
import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';
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
  ArrowRight,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import api, { getApiErrorMessage } from '../../services/api';
import CustomAlert from '../../components/ui/CustomAlert';

const { width: SW, height: SH } = Dimensions.get('window');

const PURPLE = '#6C47FF';
const PURPLE_LIGHT = '#F5F3FF';

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
  const [focusedSection, setFocusedSection] = useState('mpin');
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' });

  const mpinInputRef = useRef(null);
  const confirmInputRef = useRef(null);
  const scrollRef = useRef(null);

  const { keyboardVisible, keyboardHeight, bottomInset } = useKeyboardBottomInset(30);

  useEffect(() => {
    const timer = setTimeout(() => {
      mpinInputRef.current?.focus();
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const safeTopPadding = Math.max(insets.top, statusBarHeight) + 14;
  const safeBottomPadding = Math.max(insets.bottom, 16);

  const normalizedRole = (role || 'CUSTOMER').toUpperCase();
  const roleMeta = ROLE_META[normalizedRole] || ROLE_META.CUSTOMER;
  const RoleIcon = roleMeta.icon;

  const isMatched = mpin.length === 4 && confirmMpin.length === 4 && mpin === confirmMpin;
  const isMismatched = confirmMpin.length === 4 && mpin.length === 4 && mpin !== confirmMpin;

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
  const cardBorder = isDarkMode ? '#1E293B' : '#EDF0F7';
  const textMain = isDarkMode ? '#F8FAFC' : '#0F172A';
  const textSub = isDarkMode ? '#94A3B8' : '#64748B';
  const inputBg = isDarkMode ? '#0B1120' : '#F8FAFC';
  const inputBorder = isDarkMode ? '#1E293B' : '#E2E8F0';

  return (
    <View style={[styles.root, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8F9FD' }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Ambient Gradient Canvas (HomeScreen standard) */}
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
          {/* Top Brand Header */}
          <View style={styles.headerBlock}>
            <View style={styles.logoRow}>
              <KwicklyIcon size={38} />
              <Text style={[styles.wordmark, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
                Kwick<Text style={{ color: '#6C47FF' }}>ly</Text>
              </Text>
            </View>

            <View style={[styles.pillBadge, { backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.15)' : '#FFFFFF', borderColor: isDarkMode ? 'rgba(108, 71, 255, 0.3)' : '#E2E8F0' }]}>
              <Sparkles size={12} color="#6C47FF" />
              <Text style={[styles.pillText, { color: isDarkMode ? '#C4B5FD' : '#475569' }]}>
                Security Setup · Almost Done
              </Text>
            </View>

            <Text style={[styles.title, { color: textMain }]}>
              Create <Text style={{ color: '#6C47FF' }}>4-Digit MPIN</Text>
            </Text>
            <Text style={[styles.subtitle, { color: textSub }]}>
              Use this secure MPIN to sign in quickly anytime
            </Text>
          </View>

          {/* Floating Form Card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            {/* User Info Chip */}
            <View style={[styles.userChip, { backgroundColor: inputBg, borderColor: inputBorder }]}>
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

            {/* ── NEW 4-DIGIT MPIN SECTION ── */}
            <View style={styles.fieldHeader}>
              <Text style={[styles.fieldLabel, { color: textSub }]}>NEW 4-DIGIT MPIN</Text>
              <TouchableOpacity onPress={() => setShowMpin(!showMpin)} style={styles.toggleRow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                {showMpin ? <EyeOff size={13} color={PURPLE} /> : <Eye size={13} color={PURPLE} />}
                <Text style={[styles.toggleText, { color: PURPLE }]}>{showMpin ? 'Hide PIN' : 'Show PIN'}</Text>
              </TouchableOpacity>
            </View>

            {/* Hidden native input for New MPIN */}
            <TextInput
              ref={mpinInputRef}
              style={styles.hiddenInput}
              keyboardType="phone-pad"
              maxLength={4}
              editable={!loading}
              value={mpin}
              onChangeText={(t) => {
                const clean = t.replace(/\D/g, '').slice(0, 4);
                setMpin(clean);
                if (clean.length === 4) {
                  confirmInputRef.current?.focus();
                  setFocusedSection('confirm');
                }
              }}
              onFocus={() => {
                setFocusedSection('mpin');
                setTimeout(() => scrollRef.current?.scrollTo({ y: 60, animated: true }), 100);
              }}
              onBlur={() => { if (focusedSection === 'mpin') setFocusedSection(null); }}
              caretHidden
            />

            {/* Visual 4-box display for New MPIN */}
            <Pressable
              onPress={() => { mpinInputRef.current?.focus(); setFocusedSection('mpin'); }}
              style={styles.pinRow}
            >
              {[0, 1, 2, 3].map((i) => {
                const filled = mpin.length > i;
                const active = mpin.length === i && focusedSection === 'mpin';
                return (
                  <View
                    key={i}
                    style={[
                      styles.pinBox,
                      { backgroundColor: inputBg, borderColor: active ? PURPLE : filled ? PURPLE : inputBorder },
                      active && styles.pinBoxActiveGlow,
                    ]}
                  >
                    {filled ? (
                      showMpin ? (
                        <Text style={[styles.pinDigit, { color: textMain }]}>{mpin[i]}</Text>
                      ) : (
                        <View style={[styles.pinDot, { backgroundColor: PURPLE }]} />
                      )
                    ) : (
                      <View style={[styles.pinEmptyDot, { backgroundColor: isDarkMode ? '#2D3454' : '#CBD5E1' }]} />
                    )}
                  </View>
                );
              })}
            </Pressable>

            {/* ── CONFIRM 4-DIGIT MPIN SECTION ── */}
            <View style={[styles.fieldHeader, { marginTop: 18 }]}>
              <Text style={[styles.fieldLabel, { color: textSub }]}>CONFIRM 4-DIGIT MPIN</Text>
              {isMatched && (
                <View style={styles.matchTag}>
                  <CheckCircle2 size={13} color="#10B981" />
                  <Text style={styles.matchTagText}>Matched</Text>
                </View>
              )}
              {isMismatched && (
                <View style={styles.mismatchTag}>
                  <X size={13} color="#EF4444" />
                  <Text style={styles.mismatchTagText}>Does not match</Text>
                </View>
              )}
            </View>

            {/* Hidden native input for Confirm MPIN */}
            <TextInput
              ref={confirmInputRef}
              style={styles.hiddenInput}
              keyboardType="phone-pad"
              maxLength={4}
              editable={!loading}
              value={confirmMpin}
              onChangeText={(t) => {
                const clean = t.replace(/\D/g, '').slice(0, 4);
                setConfirmMpin(clean);
                if (clean.length === 4 && mpin.length === 4 && clean === mpin) {
                  Keyboard.dismiss();
                  handleSetMpin(mpin, clean);
                }
              }}
              onFocus={() => {
                setFocusedSection('confirm');
                setTimeout(() => scrollRef.current?.scrollTo({ y: 170, animated: true }), 100);
              }}
              onBlur={() => { if (focusedSection === 'confirm') setFocusedSection(null); }}
              caretHidden
            />

            {/* Visual 4-box display for Confirm MPIN */}
            <Pressable
              onPress={() => { confirmInputRef.current?.focus(); setFocusedSection('confirm'); }}
              style={styles.pinRow}
            >
              {[0, 1, 2, 3].map((i) => {
                const filled = confirmMpin.length > i;
                const active = confirmMpin.length === i && focusedSection === 'confirm';
                const isMismatchBox = isMismatched && filled;
                const isMatchBox = isMatched;
                return (
                  <View
                    key={i}
                    style={[
                      styles.pinBox,
                      {
                        backgroundColor: inputBg,
                        borderColor: isMatchBox ? '#10B981' : isMismatchBox ? '#EF4444' : active ? PURPLE : filled ? PURPLE : inputBorder,
                      },
                      active && styles.pinBoxActiveGlow,
                    ]}
                  >
                    {filled ? (
                      showMpin ? (
                        <Text style={[styles.pinDigit, { color: isMatchBox ? '#10B981' : isMismatchBox ? '#EF4444' : textMain }]}>
                          {confirmMpin[i]}
                        </Text>
                      ) : (
                        <View style={[styles.pinDot, { backgroundColor: isMatchBox ? '#10B981' : isMismatchBox ? '#EF4444' : PURPLE }]} />
                      )
                    ) : (
                      <View style={[styles.pinEmptyDot, { backgroundColor: isDarkMode ? '#2D3454' : '#CBD5E1' }]} />
                    )}
                  </View>
                );
              })}
            </Pressable>

            {/* Security hint */}
            <View style={[styles.hintBox, { backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.08)' : '#F8FAFC', borderColor: inputBorder }]}>
              <Text style={styles.hintIcon}>💡</Text>
              <Text style={[styles.hintText, { color: textSub }]}>
                Never share your MPIN. Avoid simple sequences like 1234 or 0000.
              </Text>
            </View>

            {/* CTA Button */}
            <TouchableOpacity
              style={[styles.btnShadow, { opacity: (isMatched && !loading) ? 1 : 0.45, marginTop: 18 }]}
              onPress={() => handleSetMpin(mpin, confirmMpin)}
              disabled={!isMatched || loading}
              activeOpacity={0.88}
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
                    <Text style={styles.ctaText}>Complete & Sign In</Text>
                    <ArrowRight size={18} color="#FFF" style={{ marginLeft: 8 }} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Bottom Security Trust Badge */}
          <View style={styles.trustFooter}>
            <ShieldCheck size={14} color="#10B981" />
            <Text style={[styles.trustText, { color: textSub }]}>
              Bank-grade 256-bit encryption · 100% Secure
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={() => setAlertConfig(p => ({ ...p, visible: false }))}
        onRequestClose={() => setAlertConfig(p => ({ ...p, visible: false }))}
      />
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
  headerBlock: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  wordmark: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 10,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 3,
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
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 16,
    gap: 10,
  },
  roleIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 14,
    fontWeight: '800',
  },
  userPhone: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  pinBox: {
    width: Math.min(SW * 0.15, 62),
    height: Math.min(SW * 0.16, 64),
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBoxActiveGlow: {
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  pinDigit: {
    fontSize: 22,
    fontWeight: '900',
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  pinEmptyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  matchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchTagText: {
    color: '#10B981',
    fontSize: 11.5,
    fontWeight: '700',
  },
  mismatchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mismatchTagText: {
    color: '#EF4444',
    fontSize: 11.5,
    fontWeight: '700',
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 18,
    gap: 8,
  },
  hintIcon: {
    fontSize: 16,
  },
  hintText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
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
  trustFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  trustText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
});

export default SetMpinScreen;
