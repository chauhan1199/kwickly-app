import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  TextInput,
  Modal,
  Image
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const SetPasswordScreen = ({ navigation, route }) => {
  const { phone, role, name = 'Your Name', token } = route.params || {};
  const { theme, isDarkMode } = useTheme();
  const { signIn } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [authPayload, setAuthPayload] = useState(null);

  // Derived styling constants
  const roleLabels = { CUSTOMER: 'Customer', WORKER: 'Worker / Pro', SHOP: 'Shop Owner' };
  const roleIcons = { CUSTOMER: '👤', WORKER: '🛠', SHOP: '🏪' };
  
  const displayRole = roleLabels[role] || 'Customer';
  const displayIcon = roleIcons[role] || '👤';

  const handleSetPassword = async () => {
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.patch('/auth/set-password', { password }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Prepare auth payload for after modal dismisses
      const user = route.params?.user || { phone, role };
      setAuthPayload({ token, role: user.role || role });
      
      // Show custom success modal instead of Alert
      setShowSuccessModal(true);
      
    } catch (error) {
      console.error(error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  const handleContinueToApp = async () => {
    setShowSuccessModal(false);
    if (authPayload) {
      await signIn(authPayload.token, authPayload.role);
    }
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      
      {/* Header matching prototype exactly */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Set Password</Text>
          <View style={styles.headerRight}>
            <Image source={require('../../assets/images/logo.jpeg')} style={styles.headerLogo} />
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.body}>
            
            {/* User Info Card */}
            <View style={styles.userCard}>
              <Text style={styles.userIcon}>{displayIcon}</Text>
              <View>
                <Text style={styles.userName}>{name}</Text>
                <Text style={styles.userDetails}>+91 {phone || '92743XXXXX'} · {displayRole}</Text>
              </View>
            </View>

            <Text style={styles.title}>Create your password</Text>
            <Text style={styles.subtitle}>Use this to login next time</Text>

            <Text style={styles.inputLabel}>New Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput 
                style={styles.textInput}
                placeholder="Minimum 6 characters"
                placeholderTextColor={theme.colors.textDim}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                {showPassword ? <EyeOff size={20} color={theme.colors.textDim} /> : <Eye size={20} color={theme.colors.textDim} />}
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={[styles.inputWrapper, { marginBottom: 20 }]}>
              <TextInput 
                style={styles.textInput}
                placeholder="Re-enter password"
                placeholderTextColor={theme.colors.textDim}
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                {showPassword ? <EyeOff size={20} color={theme.colors.textDim} /> : <Eye size={20} color={theme.colors.textDim} />}
              </TouchableOpacity>
            </View>

            {/* Password strength tips */}
            <View style={styles.tipsBox}>
              <Text style={styles.tipsTitle}>Password strength tips:</Text>
              <View style={styles.tipRow}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>At least 6 characters</Text>
              </View>
              <View style={styles.tipRow}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>Mix letters & numbers</Text>
              </View>
              <View style={styles.tipRow}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>Avoid your phone number</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.btn} onPress={handleSetPassword} disabled={loading}>
              <Text style={styles.btnText}>{loading ? 'Creating...' : '🎉 Create My Account'}</Text>
            </TouchableOpacity>

            <Text style={styles.footerText}>
              By registering you agree to our <Text style={{color: theme.colors.primary, fontWeight: 'bold'}}>Terms & Privacy Policy</Text>
            </Text>
            
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.logoWrap}>
              <Image source={require('../../assets/images/logo.jpeg')} style={styles.logoImage} />
            </View>
            <Text style={styles.modalTitle}>Welcome to Kwickly!</Text>
            <Text style={styles.modalSubtitle}>Your account has been created successfully. You're all set.</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={handleContinueToApp}>
              <Text style={styles.btnText}>Let's Go 🎉</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 16 : 12,
    paddingBottom: 8,
    backgroundColor: theme.colors.background,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  headerLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    resizeMode: 'cover',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.border,
  },
  stepDotDone: {
    backgroundColor: theme.colors.text,
  },
  stepDotActive: {
    width: 24,
    backgroundColor: theme.colors.primary,
  },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    padding: 16,
    paddingTop: 10,
  },
  userCard: {
    backgroundColor: theme.colors.primary + '10',
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  userIcon: {
    fontSize: 24,
  },
  userName: {
    fontWeight: '700',
    fontSize: 15,
    color: theme.colors.text,
  },
  userDetails: {
    fontSize: 13,
    color: theme.colors.textDim,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textDim,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textDim,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    height: 54,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    color: theme.colors.text,
    height: '100%',
  },
  eyeBtn: {
    padding: 14,
  },
  tipsBox: {
    backgroundColor: theme.colors.surfaceMuted || '#f1f4f8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tipBullet: {
    color: theme.colors.textDim,
    fontSize: 12,
    marginRight: 6,
  },
  tipText: {
    fontSize: 11,
    color: theme.colors.textDim,
  },
  btn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    padding: 18,
    width: '100%',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 16,
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    color: theme.colors.textDim,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    width: '100%',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    resizeMode: 'cover',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 15,
    color: theme.colors.textDim,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  modalBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  }
});

export default SetPasswordScreen;
