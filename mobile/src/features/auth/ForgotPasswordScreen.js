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
  Image,
  Modal
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { ChevronLeft, Phone, Lock, Hash } from 'lucide-react-native';
import api from '../../services/api';

const ForgotPasswordScreen = ({ navigation, route }) => {
  const { role = 'CUSTOMER', prefillPhone = '' } = route.params || {};
  const { theme, isDarkMode } = useTheme();
  
  const [step, setStep] = useState('PHONE'); // 'PHONE' | 'RESET'
  const [phone, setPhone] = useState(prefillPhone);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleSendOTP = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { phone, role });
      setStep('RESET');
    } catch (error) {
      console.error(error);
      const errDetails = error.response?.data?.message || 'Failed to send reset OTP';
      Alert.alert('Error', errDetails);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!code || code.length < 4) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { 
        phone, 
        code, 
        newPassword, 
        role 
      });
      setShowSuccessModal(true);
    } catch (error) {
      console.error(error);
      const errDetails = error.response?.data?.message || 'Failed to reset password';
      Alert.alert('Error', errDetails);
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={() => step === 'RESET' ? setStep('PHONE') : navigation.goBack()}
          >
            <ChevronLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reset Password</Text>
          <View style={styles.headerRight}>
            <Image source={require('../../assets/images/logo.jpeg')} style={styles.headerLogo} />
          </View>
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.body}>
            
            {step === 'PHONE' ? (
              <>
                <Text style={styles.title}>Forgot Password?</Text>
                <Text style={styles.subtitle}>Enter your registered mobile number to receive a reset code.</Text>
                
                <View style={styles.formSpace}>
                  <Input 
                    label="Mobile Number"
                    placeholder="10-digit number"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={phone}
                    onChangeText={setPhone}
                    iconLeft={<Phone size={20} />}
                  />
                  
                  <Button 
                    title="Send Reset Code" 
                    onPress={handleSendOTP} 
                    loading={loading}
                    style={{ marginTop: 24 }}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.title}>Create New Password</Text>
                <Text style={styles.subtitle}>Enter the code sent to +91 {phone}</Text>
                
                <View style={styles.formSpace}>
                  <Input 
                    label="Verification Code"
                    placeholder="e.g. 4729"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={code}
                    onChangeText={setCode}
                    iconLeft={<Hash size={20} />}
                  />
                  
                  <Input 
                    label="New Password"
                    placeholder="Minimum 6 characters"
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                    iconLeft={<Lock size={20} />}
                  />
                  
                  <Input 
                    label="Confirm New Password"
                    placeholder="Re-enter password"
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    iconLeft={<Lock size={20} />}
                  />
                  
                  <Button 
                    title="Update Password" 
                    onPress={handleResetPassword} 
                    loading={loading}
                    style={{ marginTop: 24 }}
                  />
                </View>
              </>
            )}

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
            <Text style={styles.modalTitle}>Password Reset!</Text>
            <Text style={styles.modalSubtitle}>Your password has been successfully updated. You can now login with your new password.</Text>
            <TouchableOpacity 
              style={styles.modalBtn} 
              onPress={() => {
                setShowSuccessModal(false);
                navigation.navigate('Login', { prefillPhone: phone, role });
              }}
            >
              <Text style={styles.btnText}>Go to Login</Text>
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
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textMuted,
    marginBottom: 32,
    lineHeight: 22,
  },
  formSpace: {
    marginTop: 16,
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
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

export default ForgotPasswordScreen;
