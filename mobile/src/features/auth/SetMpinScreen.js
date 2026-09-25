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
  useWindowDimensions,
  ScrollView,
  KeyboardAvoidingView,
  Pressable,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';
import { useKeyboardBottomInset } from '../../hooks/useKeyboardBottomInset';
import { getSafeBottomInset, getSafeTopInset } from '../../utils/safeInsets';
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
  Zap,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import api, { getApiErrorMessage } from '../../services/api';
import CustomAlert from '../../components/ui/CustomAlert';

const PURPLE = '#6C47FF';
const PURPLE_LIGHT = '#F5F3FF';

const ROLE_META = {
  CUSTOMER: { label: 'Customer', icon: User, color: PURPLE, bg: PURPLE_LIGHT },
  WORKER: { label: 'Worker', icon: Wrench, color: '#10B981', bg: '#D1FAE5' },
  SHOP: { label: 'Shop Owner', icon: Store, color: '#F59E0B', bg: '#FEF3C7' },
};

const SetMpinScreen = ({ navigation, route }) => {
  const { phone = '', role = 'CUSTOMER', name = 'User', token = null, user = null } = route.params || {};
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const screenHeight = Dimensions.get('screen').height;
  const isSmallScreen = windowHeight < 720;
  const isTallScreen = windowHeight >= 760;
  const shouldCenter = !keyboardVisible && windowHeight >= 700;
  const { signIn } = useAuth();

  const [mpin, setMpin] = useState('');
  const [showMpin, setShowMpin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isMpinFocused, setIsMpinFocused] = useState(true);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' });

  const mpinInputRef = useRef(null);
  const scrollRef = useRef(null);

  const { keyboardVisible, keyboardHeight, bottomInset } = useKeyboardBottomInset(30);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      mpinInputRef.current?.focus();
    }, 150);
    const timer2 = setTimeout(() => {
      mpinInputRef.current?.focus();
    }, 400);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const safeTopPadding = getSafeTopInset(insets, isSmallScreen ? 8 : 14);
  const safeBottomInset = getSafeBottomInset(insets, isSmallScreen ? 4 : 8);

  const normalizedRole = (role || 'CUSTOMER').toUpperCase();
  const roleMeta = ROLE_META[normalizedRole] || ROLE_META.CUSTOMER;
  const RoleIcon = roleMeta.icon;

  const showAlert = (title, message, type = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const handleSetMpin = async (pinOverride) => {
    const activePin = typeof pinOverride === 'string' ? pinOverride : mpin;

    if (!activePin || activePin.length !== 4 || !/^\d{4}$/.test(activePin)) {
      showAlert('Invalid MPIN', 'Please enter a valid 4-digit numeric MPIN.');
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
              paddingBottom: keyboardVisible
                ? (keyboardHeight || bottomInset)
                : safeBottomInset,
              justifyContent: shouldCenter ? 'center' : 'flex-start',
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          scrollEnabled={true}
        >
          <View style={styles.topSection}>
            {/* Header Layout Row: Headline Left, 3D Hero Right */}
            <View style={[styles.headerLayoutRow, isSmallScreen && { marginBottom: 4 }, isTallScreen && { marginBottom: 12 }]}>
              <View style={styles.headerTextCol}>
                <Text style={[styles.heroHeadline, { fontSize: isSmallScreen ? 19 : isTallScreen ? 24 : 22, lineHeight: isSmallScreen ? 23 : isTallScreen ? 28 : 26, color: textMain }]}>
                  Create{'\n'}
                  <Text style={{ color: PURPLE }}>4-Digit MPIN</Text>
                </Text>
                <Text style={[styles.heroSub, { color: textSub }, isSmallScreen && { fontSize: 11 }, isTallScreen && { fontSize: 12, marginTop: 4 }]}>
                  Use this secure MPIN to sign in quickly anytime
                </Text>
                <View style={[styles.safeShieldPill, isSmallScreen && { paddingVertical: 2, paddingHorizontal: 6, marginTop: 3 }, isTallScreen && { marginTop: 6 }]}>
                  <ShieldCheck size={isSmallScreen ? 12 : 14} color={PURPLE} />
                  <Text style={[styles.safeShieldText, isSmallScreen && { fontSize: 9.5 }]}>Your data is safe with us</Text>
                </View>
              </View>
              <Image
                source={
                  isDarkMode
                    ? require('../../assets/images/hero_mpin_dark.png')
                    : require('../../assets/images/hero_mpin.png')
                }
                style={[styles.heroMpinImg, isSmallScreen && { width: 80, height: 65 }, isTallScreen && { width: 110, height: 90 }]}
                resizeMode="contain"
              />
            </View>

            {/* Floating Form Card */}
            <View style={[
              styles.card,
              { backgroundColor: cardBg, borderColor: cardBorder },
              isSmallScreen && { paddingVertical: 10, paddingHorizontal: 14 },
              isTallScreen && { paddingVertical: 20, paddingHorizontal: 20 },
            ]}>
              <View>
                {/* User Info Chip */}
                <View style={[styles.userChip, { backgroundColor: inputBg, borderColor: inputBorder }, isSmallScreen && { paddingVertical: 4, paddingHorizontal: 8, marginBottom: 6 }, isTallScreen && { paddingVertical: 10, paddingHorizontal: 12, marginBottom: 14 }]}>
                  <View style={[styles.roleIconCircle, isSmallScreen && { width: 26, height: 26, borderRadius: 13 }, { backgroundColor: roleMeta.bg }]}>
                    <RoleIcon size={isSmallScreen ? 13 : 16} color={roleMeta.color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                    <Text style={[styles.userName, { color: textMain, fontSize: isSmallScreen ? 12 : 13 }]} numberOfLines={1} ellipsizeMode="tail">
                      {name || 'User'}
                    </Text>
                    <Text style={[styles.userPhone, { color: textSub, fontSize: isSmallScreen ? 10.5 : 11.5 }]} numberOfLines={1} ellipsizeMode="tail">
                      +91 {phone} · {roleMeta.label}
                    </Text>
                  </View>
                  <View style={[styles.verifiedBadge, { flexShrink: 0 }]}>
                    <ShieldCheck size={isSmallScreen ? 11 : 13} color="#10B981" />
                    <Text style={[styles.verifiedText, isSmallScreen && { fontSize: 10 }]}>Verified</Text>
                  </View>
                </View>

                {/* ── 4-DIGIT MPIN SECTION ── */}
                <View style={[styles.fieldHeader, isSmallScreen && { marginBottom: 4 }]}>
                  <Text style={[styles.fieldLabel, { color: textSub, fontSize: isSmallScreen ? 9.5 : 10.5 }]}>ENTER 4-DIGIT MPIN</Text>
                  <TouchableOpacity onPress={() => setShowMpin(!showMpin)} style={styles.toggleRow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    {showMpin ? <EyeOff size={13} color={PURPLE} /> : <Eye size={13} color={PURPLE} />}
                    <Text style={[styles.toggleText, { color: PURPLE, fontSize: isSmallScreen ? 11 : 12 }]}>{showMpin ? 'Hide PIN' : 'Show PIN'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Visual 4-box display for MPIN with touchable overlay */}
                <View style={[styles.pinContainer, isSmallScreen && { marginBottom: 6 }, isTallScreen && { marginBottom: 16 }]}>
                  <View
                    pointerEvents="none"
                    style={styles.pinRow}
                  >
                    {[0, 1, 2, 3].map((i) => {
                      const filled = mpin.length > i;
                      const active = mpin.length === i && isMpinFocused;
                      return (
                        <View
                          key={i}
                          style={[
                            styles.pinBox,
                            isSmallScreen && { width: 46, height: 46, borderRadius: 12 },
                            isTallScreen && { width: 56, height: 56, borderRadius: 16 },
                            { backgroundColor: inputBg, borderColor: active ? PURPLE : filled ? PURPLE : inputBorder },
                            active && styles.pinBoxActiveGlow,
                          ]}
                        >
                          {filled ? (
                            showMpin ? (
                              <Text style={[styles.pinDigit, { color: textMain, fontSize: isSmallScreen ? 16 : 18 }]}>{mpin[i]}</Text>
                            ) : (
                              <View style={[styles.pinDot, isSmallScreen && { width: 8, height: 8, borderRadius: 4 }, { backgroundColor: PURPLE }]} />
                            )
                          ) : (
                            <View style={[styles.pinEmptyDot, { backgroundColor: isDarkMode ? '#2D3454' : '#CBD5E1' }]} />
                          )}
                        </View>
                      );
                    })}
                  </View>

                  {/* Real touchable input overlay */}
                  <TextInput
                    ref={mpinInputRef}
                    style={styles.realMpinOverlay}
                    keyboardType="number-pad"
                    maxLength={4}
                    editable={!loading}
                    value={mpin}
                    onChangeText={(t) => {
                      const clean = t.replace(/\D/g, '').slice(0, 4);
                      setMpin(clean);
                      if (clean.length === 4) {
                        Keyboard.dismiss();
                        handleSetMpin(clean);
                      }
                    }}
                    onFocus={() => setIsMpinFocused(true)}
                    onBlur={() => setIsMpinFocused(false)}
                    caretHidden
                    autoFocus={true}
                  />
                </View>

                {/* Security hint */}
                <View style={[styles.hintBox, { backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.08)' : '#F8FAFC', borderColor: inputBorder }, isSmallScreen && { paddingVertical: 6, paddingHorizontal: 8, marginTop: 4 }, isTallScreen && { paddingVertical: 12, paddingHorizontal: 14, marginTop: 12 }]}>
                  <Text style={styles.hintIcon}>💡</Text>
                  <Text style={[styles.hintText, { color: textSub, fontSize: isSmallScreen ? 10.5 : 11.5 }]}>
                    Never share your MPIN. Avoid simple sequences like 1234 or 0000.
                  </Text>
                </View>

                {/* Security Benefits (only on tall screens when keyboard not visible) */}
                {isTallScreen && !keyboardVisible && (
                  <View style={[styles.securityBenefitsCard, { backgroundColor: isDarkMode ? '#1E2540' : '#F5F3FF', borderColor: isDarkMode ? '#2D3760' : '#EDE9FE' }]}>
                    <View style={styles.benefitRow}>
                      <View style={[styles.benefitIconWrap, { backgroundColor: isDarkMode ? '#2D3760' : '#EDE9FE' }]}>
                        <Zap size={13} color={PURPLE} />
                      </View>
                      <View style={styles.benefitContent}>
                        <Text style={[styles.benefitTitle, { color: textMain }]}>Instant 1-Tap Login</Text>
                        <Text style={[styles.benefitDesc, { color: textSub }]}>No waiting for SMS OTP on your trusted device</Text>
                      </View>
                    </View>
                    <View style={[styles.benefitRow, { marginTop: 8 }]}>
                      <View style={[styles.benefitIconWrap, { backgroundColor: isDarkMode ? '#133929' : '#DCFCE7' }]}>
                        <ShieldCheck size={13} color="#10B981" />
                      </View>
                      <View style={styles.benefitContent}>
                        <Text style={[styles.benefitTitle, { color: textMain }]}>Bank-Grade 256-Bit Protection</Text>
                        <Text style={[styles.benefitDesc, { color: textSub }]}>Hardware-backed security for all transactions</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* CTA Button */}
              <TouchableOpacity
                style={[styles.btnShadow, { opacity: (mpin.length === 4 && !loading) ? 1 : 0.45, marginTop: isSmallScreen ? 8 : (isTallScreen ? 18 : 14) }]}
                onPress={() => handleSetMpin(mpin)}
                disabled={mpin.length !== 4 || loading}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={[PURPLE, '#582BE8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.ctaBtn, isSmallScreen && { height: 42 }, isTallScreen && { height: 52 }]}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Text style={[styles.ctaText, isSmallScreen && { fontSize: 14.5 }]}>Complete & Sign In</Text>
                      <ArrowRight size={isSmallScreen ? 15 : 17} color="#FFF" style={{ marginLeft: 6 }} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Bottom Section - cleanly grouped under card */}
            <View style={[styles.bottomSection, isSmallScreen && { marginTop: 4 }, isTallScreen && { marginTop: 14 }]}>
              {/* Bottom Trust Bar Pill */}
              <View style={[
                styles.trustBarCard,
                isSmallScreen && { paddingVertical: 5, paddingHorizontal: 8 },
                {
                  backgroundColor: isDarkMode ? 'rgba(19, 27, 46, 0.85)' : 'rgba(255, 255, 255, 0.92)',
                  borderColor: cardBorder,
                },
              ]}>
                <View style={styles.trustBadgeItem}>
                  <ShieldCheck size={14} color="#10B981" />
                  <Text style={[styles.trustTitle, { color: textMain, fontSize: isSmallScreen ? 10 : 11 }]}>100% Secure</Text>
                </View>

                <View style={styles.trustDividerDot} />

                <View style={styles.trustBadgeItem}>
                  <Zap size={14} color={PURPLE} />
                  <Text style={[styles.trustTitle, { color: textMain, fontSize: isSmallScreen ? 10 : 11 }]}>Quick Access</Text>
                </View>

                <View style={styles.trustDividerDot} />

                <View style={styles.trustBadgeItem}>
                  <Text style={{ fontSize: 13 }}>🇮🇳</Text>
                  <Text style={[styles.trustTitle, { color: textMain, fontSize: isSmallScreen ? 10 : 11 }]}>Made in India</Text>
                </View>
              </View>

              <View style={[styles.reassuranceRow, isSmallScreen && { marginTop: 3 }]}>
                <ShieldCheck size={13} color="#10B981" />
                <Text style={[styles.reassuranceText, { color: textSub, fontSize: isSmallScreen ? 10 : 11 }]}>
                  Bank-grade 256-bit encryption · Quick PIN login enabled
                </Text>
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
    maxWidth: 480,
    alignSelf: 'center',
  },
  topSection: {
    width: '100%',
  },
  bottomSection: {
    width: '100%',
    paddingTop: 4,
    paddingBottom: 16,
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
    marginBottom: 6,
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 6,
  },
  heroHeadline: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  heroSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 14,
  },
  heroMpinImg: {
    width: 120,
    height: 85,
  },
  safeShieldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
    gap: 5,
    alignSelf: 'flex-start',
  },
  safeShieldText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6C47FF',
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
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 10,
    gap: 8,
  },
  roleIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 13,
    fontWeight: '800',
  },
  userPhone: {
    fontSize: 11.5,
    marginTop: 1,
    fontWeight: '500',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  verifiedText: {
    color: '#059669',
    fontSize: 10.5,
    fontWeight: '700',
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toggleText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  pinContainer: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  realMpinOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.01,
    backgroundColor: 'transparent',
    color: 'transparent',
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
    gap: 10,
  },
  pinBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBoxActiveGlow: {
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  pinDigit: {
    fontSize: 20,
    fontWeight: '900',
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  pinEmptyDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  matchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchTagText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  mismatchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mismatchTagText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
    gap: 6,
  },
  hintIcon: {
    fontSize: 15,
  },
  hintText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
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
  trustBarCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 8,
  },
  trustBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trustDividerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#94A3B8',
  },
  trustTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  reassuranceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 16,
  },
  reassuranceText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'center',
  },
  securityBenefitsCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  benefitDesc: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
});

export default SetMpinScreen;
