import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  TouchableOpacity, 
  StatusBar, 
  ScrollView, 
  TextInput, 
  Modal, 
  ActivityIndicator,
  Keyboard
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomAlert from '../../components/ui/CustomAlert';
import { useTheme } from '../../context/ThemeContext';
import { 
  ChevronLeft, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  ShieldCheck, 
  Lock, 
  User, 
  Store, 
  Wrench, 
  Check, 
  X 
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';

const ROLE_META = {
  CUSTOMER: { label: 'Customer', icon: User, color: '#6C47FF', bg: 'rgba(108, 71, 255, 0.12)' },
  WORKER: { label: 'Worker / Pro', icon: Wrench, color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
  SHOP: { label: 'Shop Owner', icon: Store, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
};

const SetMpinScreen = ({ navigation, route }) => {
  const { phone, role = 'CUSTOMER', name = 'User', token } = route.params || {};
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [mpin, setMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [showMpin, setShowMpin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [authPayload, setAuthPayload] = useState(null);
  const [focusedInput, setFocusedInput] = useState(null);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' });
  const confirmMpinInputRef = useRef(null);
  
  const [mpinError, setMpinError] = useState('');
  const [confirmMpinError, setConfirmMpinError] = useState('');

  // Keyboard avoidance state
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  React.useEffect(() => {
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
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const showAlert = (title, message, type = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const handleSetMpin = async (pinOverride, confirmOverride) => {
    const activePin = pinOverride || mpin;
    const activeConfirm = confirmOverride || confirmMpin;

    setMpinError('');
    setConfirmMpinError('');

    if (!activePin || activePin.length !== 4 || !/^\d{4}$/.test(activePin)) {
      setMpinError('Please enter a valid 4-digit numeric MPIN');
      return;
    }

    if (!activeConfirm || activeConfirm.length !== 4) {
      setConfirmMpinError('Please confirm your 4-digit MPIN');
      return;
    }

    if (activePin !== activeConfirm) {
      setConfirmMpinError('MPINs do not match. Please check and re-enter.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(
        '/auth/set-mpin', 
        { mpin, password: mpin },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );

      const resData = response.data?.data;
      setAuthPayload({ token: resData?.token || token, role });
      setShowSuccessModal(true);
    } catch (error) {
      const errDetails = error.response?.data?.errors?.join(', ') || error.response?.data?.message || 'Failed to set MPIN';
      showAlert('Error', errDetails);
    } finally {
      setLoading(false);
    }
  };

  const handleModalContinue = async () => {
    setShowSuccessModal(false);
    if (authPayload && authPayload.token) {
      await signIn(authPayload.token, authPayload.role);
    } else {
      navigation.navigate('Login', { prefillPhone: phone, role });
    }
  };

  const headerTopPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 8;
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 16) + 20;
  const dynamicBottomPad = bottomPad + (keyboardVisible ? keyboardHeight + 20 : 0);
  const styles = createStyles(theme, isDarkMode, headerTopPad, dynamicBottomPad);

  const normalizedRole = (role || 'CUSTOMER').toUpperCase();
  const roleMeta = ROLE_META[normalizedRole] || ROLE_META.CUSTOMER;
  const RoleIcon = roleMeta.icon;
  const displayName = name || 'User';

  const isMatched = mpin.length === 4 && confirmMpin.length === 4 && mpin === confirmMpin;
  const isMismatched = confirmMpin.length === 4 && mpin.length === 4 && mpin !== confirmMpin;

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
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ChevronLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Set MPIN</Text>
          <View style={styles.headerRight}>
            <KwicklyIcon size={28} />
          </View>
        </View>
        <View style={styles.stepDots}>
          <View style={[styles.stepDot, styles.stepDotDone]} />
          <View style={[styles.stepDot, styles.stepDotDone]} />
          <View style={[styles.stepDot, styles.stepDotDone]} />
          <View style={[styles.stepDot, styles.stepDotActive]} />
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.body}>
            
            {/* User Profile Summary Card */}
            <View style={styles.userCard}>
              <View style={[styles.userIconBox, { backgroundColor: roleMeta.bg }]}>
                <RoleIcon size={22} color={roleMeta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{displayName}</Text>
                <Text style={styles.userDetails}>+91 {phone} • {roleMeta.label}</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <ShieldCheck size={14} color="#10B981" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>

            {/* Title */}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Create your 4-Digit MPIN</Text>
              <Text style={styles.subtitle}>
                You'll use this 4-digit Security MPIN to sign in quickly & securely.
              </Text>
            </View>

            {/* Input Card */}
            <View style={styles.inputCard}>
              {/* New MPIN */}
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>New 4-Digit MPIN</Text>
              </View>

              <View style={[
                styles.inputWrapper, 
                mpinError ? styles.inputError : null, 
                focusedInput === 'mpin' && styles.inputFocused
              ]}>
                <View style={styles.inputIcon}>
                  <Lock size={18} color={focusedInput === 'mpin' ? '#6C47FF' : theme.colors.textDim} />
                </View>
                <TextInput 
                  style={[
                    styles.textInput, 
                    { 
                      letterSpacing: mpin.length > 0 ? (showMpin ? 4 : 8) : 0, 
                      fontWeight: '800' 
                    }
                  ]}
                  placeholder="Enter 4-digit MPIN"
                  placeholderTextColor={theme.colors.textDim}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry={!showMpin}
                  value={mpin}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
                    setMpin(cleaned);
                    setMpinError('');
                    if (cleaned.length === 4) {
                      confirmMpinInputRef.current?.focus();
                    }
                  }}
                  onFocus={() => setFocusedInput('mpin')}
                  onBlur={() => setFocusedInput(null)}
                />
                <TouchableOpacity 
                  onPress={() => setShowMpin(!showMpin)} 
                  style={styles.eyeBtn}
                  activeOpacity={0.7}
                >
                  {showMpin ? (
                    <EyeOff size={18} color="#6C47FF" />
                  ) : (
                    <Eye size={18} color={theme.colors.textDim} />
                  )}
                </TouchableOpacity>
              </View>
              {mpinError ? <Text style={styles.errorText}>{mpinError}</Text> : null}

              {/* Confirm MPIN */}
              <View style={[styles.labelRow, { marginTop: 16 }]}>
                <Text style={styles.inputLabel}>Confirm 4-Digit MPIN</Text>
                {isMatched && (
                  <View style={styles.matchBadgeSuccess}>
                    <Check size={12} color="#10B981" />
                    <Text style={styles.matchTextSuccess}>MPINs Match</Text>
                  </View>
                )}
                {isMismatched && (
                  <View style={styles.matchBadgeError}>
                    <X size={12} color="#EF4444" />
                    <Text style={styles.matchTextError}>Do not match</Text>
                  </View>
                )}
              </View>

              <View style={[
                styles.inputWrapper, 
                confirmMpinError || isMismatched ? styles.inputError : null, 
                isMatched ? styles.inputSuccess : null,
                focusedInput === 'confirmMpin' && styles.inputFocused
              ]}>
                <View style={styles.inputIcon}>
                  <ShieldCheck size={18} color={isMatched ? '#10B981' : focusedInput === 'confirmMpin' ? '#6C47FF' : theme.colors.textDim} />
                </View>
                <TextInput 
                  ref={confirmMpinInputRef}
                  style={[
                    styles.textInput, 
                    { 
                      letterSpacing: confirmMpin.length > 0 ? (showMpin ? 4 : 8) : 0, 
                      fontWeight: '800' 
                    }
                  ]}
                  placeholder="Re-enter 4-digit MPIN"
                  placeholderTextColor={theme.colors.textDim}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry={!showMpin}
                  value={confirmMpin}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
                    setConfirmMpin(cleaned);
                    setConfirmMpinError('');
                    if (cleaned.length === 4 && mpin.length === 4) {
                      if (cleaned === mpin) {
                        Keyboard.dismiss();
                        handleSetMpin(mpin, cleaned);
                      }
                    }
                  }}
                  onFocus={() => setFocusedInput('confirmMpin')}
                  onBlur={() => setFocusedInput(null)}
                />
                {isMatched && (
                  <View style={styles.checkIconBox}>
                    <Check size={18} color="#10B981" />
                  </View>
                )}
              </View>
              {confirmMpinError ? <Text style={styles.errorText}>{confirmMpinError}</Text> : null}
            </View>

            {/* Security Tip Card */}
            <View style={styles.tipCard}>
              <View style={styles.tipHeader}>
                <Text style={styles.tipIcon}>💡</Text>
                <Text style={styles.tipTitle}>Security Tip:</Text>
              </View>
              <Text style={styles.tipText}>
                Choose a 4-digit PIN that is easy for you to remember but hard for others to guess. Avoid consecutive numbers like 1234 or repeated numbers like 0000.
              </Text>
            </View>

            <View style={styles.spacer} />

            {/* Action Button */}
            <TouchableOpacity 
              style={[styles.btnShadow, { opacity: (isMatched && !loading) ? 1 : 0.65 }]} 
              onPress={handleSetMpin} 
              disabled={!isMatched || loading} 
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#7C3AED', '#6C47FF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.btnGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.btnText}>Set MPIN & Complete Registration →</Text>
                )}
              </LinearGradient>
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

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.successModal}>
            <View style={styles.modalIconBox}>
              <CheckCircle2 size={44} color="#10B981" />
            </View>
            <Text style={styles.modalTitle}>MPIN Set Successfully!</Text>
            <Text style={styles.modalDesc}>
              Welcome to Kwickly! Your 4-digit MPIN is active. You can now sign in anytime using your mobile number and MPIN.
            </Text>
            
            <TouchableOpacity 
              style={[styles.btnShadow, { width: '100%', marginBottom: 0 }]} 
              onPress={handleModalContinue}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#7C3AED', '#6C47FF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.btnGradient}
              >
                <Text style={styles.btnText}>Let's Get Started →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
  stepDotDone: {
    width: 14,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
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
    paddingHorizontal: 20,
    paddingTop: 18,
    width: '100%',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: 18,
    padding: 14,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  userIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  userDetails: {
    fontSize: 12.5,
    color: theme.colors.textDim,
    fontWeight: '500',
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  titleContainer: {
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textDim,
    fontWeight: '500',
    lineHeight: 20,
  },
  inputCard: {
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: theme.colors.text,
  },
  eyeBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIconBox: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipIcon: {
    fontSize: 14,
    marginRight: 2,
  },
  matchBadgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchTextSuccess: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  matchBadgeError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchTextError: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 52,
  },
  inputFocused: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.06)' : '#FFFFFF',
  },
  inputSuccess: {
    borderColor: '#10B981',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.06)' : '#FEF2F2',
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    padding: 0,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  tipCard: {
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.08)' : '#F5F3FF',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(108, 71, 255, 0.2)' : '#EDE9FE',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6C47FF',
  },
  tipText: {
    fontSize: 12.5,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    lineHeight: 18,
    fontWeight: '500',
  },
  spacer: {
    height: 16,
  },
  btnShadow: {
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModal: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  modalIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 14,
    color: theme.colors.textDim,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
});

export default SetMpinScreen;
