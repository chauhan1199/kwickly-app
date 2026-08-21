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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomAlert from '../../components/ui/CustomAlert';
import { useTheme } from '../../context/ThemeContext';
import { ChevronLeft, Eye, EyeOff, CheckCircle2, ShieldCheck, Lock } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { KwicklyIcon } from '../../components/ui/KwicklyBrand';

const SetMpinScreen = ({ navigation, route }) => {
  const { phone, role, name = 'User', token } = route.params || {};
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
  
  const [mpinError, setMpinError] = useState('');
  const [confirmMpinError, setConfirmMpinError] = useState('');

  const showAlert = (title, message, type = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const handleSetMpin = async () => {
    setMpinError('');
    setConfirmMpinError('');

    if (!mpin || mpin.length !== 4 || !/^\d{4}$/.test(mpin)) {
      setMpinError('Please enter a valid 4-digit numeric MPIN');
      return;
    }

    if (!confirmMpin || confirmMpin.length !== 4) {
      setConfirmMpinError('Please confirm your 4-digit MPIN');
      return;
    }

    if (mpin !== confirmMpin) {
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
  const styles = createStyles(theme, isDarkMode, headerTopPad);

  const displayRole = role === 'WORKER' ? 'Worker / Pro' : role === 'SHOP' ? 'Shop Owner' : 'Customer';

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
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.body}>
            
            {/* User Info Card */}
            <View style={styles.userCard}>
              <View style={styles.userIconBg}>
                <Text style={{ fontSize: 20 }}>👤</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{name}</Text>
                <Text style={styles.userDetails}>+91 {phone} • {displayRole}</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <ShieldCheck size={14} color="#10B981" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>

            <Text style={styles.title}>Create your 4-Digit MPIN</Text>
            <Text style={styles.subtitle}>You'll use this 4-digit Security MPIN to sign in quickly & securely.</Text>

            {/* New MPIN */}
            <Text style={styles.inputLabel}>New 4-Digit MPIN</Text>
            <View style={[
              styles.inputWrapper, 
              mpinError ? styles.inputError : null, 
              focusedInput === 'mpin' && styles.inputFocused
            ]}>
              <View style={styles.inputIcon}>
                <Lock size={18} color={focusedInput === 'mpin' ? '#6C47FF' : theme.colors.textDim} />
              </View>
              <TextInput 
                style={styles.textInput}
                placeholder="Enter 4-digit PIN (e.g. 1234)"
                placeholderTextColor={theme.colors.textDim}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry={!showMpin}
                value={mpin}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
                  setMpin(cleaned);
                  setMpinError('');
                }}
                onFocus={() => setFocusedInput('mpin')}
                onBlur={() => setFocusedInput(null)}
              />
              <TouchableOpacity onPress={() => setShowMpin(!showMpin)} style={styles.eyeBtn}>
                {showMpin ? <EyeOff size={18} color={theme.colors.textDim} /> : <Eye size={18} color={theme.colors.textDim} />}
              </TouchableOpacity>
            </View>
            {mpinError ? <Text style={styles.errorText}>{mpinError}</Text> : null}

            {/* PIN Indicator Dots */}
            {mpin.length > 0 && (
              <View style={styles.pinIndicatorRow}>
                {[0, 1, 2, 3].map((idx) => (
                  <View 
                    key={idx}
                    style={[
                      styles.pinDot,
                      idx < mpin.length ? styles.pinDotFilled : styles.pinDotEmpty
                    ]}
                  >
                    {showMpin && idx < mpin.length && (
                      <Text style={styles.pinDotDigit}>{mpin[idx]}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Confirm MPIN */}
            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Confirm 4-Digit MPIN</Text>
            <View style={[
              styles.inputWrapper, 
              confirmMpinError ? styles.inputError : null, 
              focusedInput === 'confirmMpin' && styles.inputFocused
            ]}>
              <View style={styles.inputIcon}>
                <Lock size={18} color={focusedInput === 'confirmMpin' ? '#6C47FF' : theme.colors.textDim} />
              </View>
              <TextInput 
                style={styles.textInput}
                placeholder="Re-enter 4-digit PIN"
                placeholderTextColor={theme.colors.textDim}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry={!showMpin}
                value={confirmMpin}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
                  setConfirmMpin(cleaned);
                  setConfirmMpinError('');
                }}
                onFocus={() => setFocusedInput('confirmMpin')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
            {confirmMpinError ? <Text style={styles.errorText}>{confirmMpinError}</Text> : null}

            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>💡 Security Tip:</Text>
              <Text style={styles.tipText}>
                Choose a 4-digit PIN that is easy for you to remember but hard for others to guess. Avoid consecutive numbers like 1234 or repeated numbers like 0000.
              </Text>
            </View>

            <View style={styles.bottomSpacer} />

            <TouchableOpacity 
              style={styles.btnShadow} 
              onPress={handleSetMpin} 
              disabled={loading} 
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#7C3AED', '#6C47FF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.btnGradient}
              >
                <Text style={styles.btnText}>
                  {loading ? 'Setting MPIN...' : 'Set MPIN & Complete Registration →'}
                </Text>
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

const createStyles = (theme, isDarkMode, headerTopPad) => StyleSheet.create({
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
  },
  body: {
    padding: 20,
    flex: 1,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#131B2E' : '#F1F4F9',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    gap: 12,
  },
  userIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.2)' : '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  userDetails: {
    fontSize: 12.5,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13.5,
    color: theme.colors.textDim,
    marginBottom: 20,
    fontWeight: '500',
    lineHeight: 19,
  },
  inputLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
    marginLeft: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
    borderRadius: 14,
    height: 52,
    marginBottom: 6,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputFocused: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.06)' : '#FFFFFF',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '700',
    letterSpacing: 2,
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
  },
  pinIndicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 10,
  },
  pinDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  pinDotFilled: {
    backgroundColor: 'rgba(108, 71, 255, 0.15)',
    borderColor: '#6C47FF',
  },
  pinDotEmpty: {
    backgroundColor: 'transparent',
    borderColor: isDarkMode ? '#334155' : '#CBD5E1',
  },
  pinDotDigit: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6C47FF',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    marginLeft: 4,
  },
  tipCard: {
    backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.08)' : '#F5F3FF',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(108, 71, 255, 0.2)' : '#EDE9FE',
    borderRadius: 14,
    padding: 12,
    marginTop: 16,
  },
  tipTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6C47FF',
    marginBottom: 3,
  },
  tipText: {
    fontSize: 11.5,
    color: theme.colors.textDim,
    lineHeight: 16,
  },
  bottomSpacer: {
    flex: 1,
    minHeight: 24,
  },
  btnShadow: {
    width: '100%',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
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
    width: '100%',
    backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 13.5,
    color: theme.colors.textDim,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  }
});

export default SetMpinScreen;
