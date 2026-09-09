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
  const [focusedSection, setFocusedSection] = useState('mpin');
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' });

  const mpinInputRef = useRef(null);
  const confirmInputRef = useRef(null);

  useEffect(() => {
    // Auto focus first PIN input on mount
    const timer = setTimeout(() => {
      mpinInputRef.current?.focus();
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  const topPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16);

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

            {/* Official Kwickly App Icon & Brand Name */}
            <View style={styles.brandRow}>
              <KwicklyIcon size={38} />
              <Text style={styles.brandName}>
                Kwick<Text style={{ color: '#FFD580' }}>ly</Text>
              </Text>
            </View>

            {/* Badge Pill */}
            <View style={styles.badgePill}>
              <Sparkles size={13} color="#FFFFFF" />
              <Text style={styles.badgePillText}>Security Setup</Text>
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

            {/* ── NEW 4-DIGIT MPIN SECTION ── */}
            <View style={styles.fieldHeader}>
              <Text style={[styles.label, { color: textSub }]}>NEW 4-DIGIT MPIN</Text>
              <TouchableOpacity onPress={() => setShowMpin(!showMpin)} style={styles.toggleRow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                {showMpin ? <EyeOff size={14} color={PURPLE} /> : <Eye size={14} color={PURPLE} />}
                <Text style={styles.toggleText}>{showMpin ? 'Hide PIN' : 'Show PIN'}</Text>
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
              onFocus={() => setFocusedSection('mpin')}
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
                      { backgroundColor: inputBg, borderColor: active ? PURPLE : filled ? PURPLE : border },
                      active && styles.pinBoxActive,
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
              <Text style={[styles.label, { color: textSub }]}>CONFIRM 4-DIGIT MPIN</Text>
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
              onFocus={() => setFocusedSection('confirm')}
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
                        borderColor: isMatchBox ? '#10B981' : isMismatchBox ? '#EF4444' : active ? PURPLE : filled ? PURPLE : border,
                      },
                      active && styles.pinBoxActive,
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
            <View style={styles.hintBox}>
              <Text style={styles.hintIcon}>💡</Text>
              <Text style={[styles.hintText, { color: textSub }]}>
                Never share your MPIN. Avoid simple sequences like 1234 or 0000.
              </Text>
            </View>

            <View style={{ flex: 1, minHeight: 20 }} />

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
                  <>
                    <Text style={styles.ctaText}>Complete & Sign In</Text>
                    <ArrowRight size={18} color="#FFF" style={{ marginLeft: 8 }} />
                  </>
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
    paddingTop: 20,
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
    marginBottom: 8,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
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
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  pinBox: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBoxActive: {
    borderWidth: 2,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  pinDigit: {
    fontSize: 22,
    fontWeight: '900',
  },
  pinDot: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
  },
  pinEmptyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 71, 255, 0.06)',
    padding: 10,
    borderRadius: 12,
    marginTop: 18,
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
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
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
    marginTop: 12,
  },
  secureText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default SetMpinScreen;
