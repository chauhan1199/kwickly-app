import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  StatusBar
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Phone, Lock, ArrowLeft } from 'lucide-react-native';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const LoginScreen = ({ navigation, route }) => {
  const { role: initialRole = 'CUSTOMER', prefillPhone = '' } = route.params || {};
  const { theme } = useTheme();
  const [role, setRole] = useState(initialRole);
  const { signIn } = useAuth();
  const [loginMode, setLoginMode] = useState('PASSWORD'); // Default to PASSWORD if they got routed here
  const [phone, setPhone] = useState(prefillPhone);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAction = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    try {
      if (loginMode === 'OTP') {
        await api.post('/auth/send-otp', { phone, role });
        navigation.navigate('OTPVerify', { phone, role });
      } else {
        const response = await api.post('/auth/login', { phone, password, role });
        const { token, user } = response.data.data;
        await signIn(token, user.role);
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.content}>
          <View style={styles.headerTop}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <ArrowLeft size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <View style={styles.headerRight}>
              <Image source={require('../../assets/images/logo.jpeg')} style={styles.headerLogo} />
            </View>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Welcome back!</Text>
            <Text style={styles.subtitle}>Select your profile type to continue</Text>
          </View>

          <View style={[styles.modeSwitcher, { backgroundColor: 'transparent', padding: 0 }]}>
            {['CUSTOMER', 'WORKER', 'SHOP'].map(r => (
              <TouchableOpacity 
                key={r}
                onPress={() => setRole(r)}
                style={[
                  styles.modeTab, 
                  role === r ? { backgroundColor: theme.colors.primary, borderWidth: 0 } : { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
                  { marginRight: r !== 'SHOP' ? 8 : 0, borderRadius: 20, paddingVertical: 8 }
                ]}
              >
                <Text style={[
                  styles.modeText, 
                  role === r ? { color: '#ffffff' } : { color: theme.colors.textDim },
                  { fontSize: 13, fontWeight: '700' }
                ]}>
                  {r === 'CUSTOMER' ? 'Customer' : r === 'WORKER' ? 'Worker' : 'Shop'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modeSwitcher}>
            <TouchableOpacity 
              onPress={() => setLoginMode('OTP')}
              style={[styles.modeTab, loginMode === 'OTP' && { backgroundColor: theme.colors.primary }]}
            >
              <Text style={[styles.modeText, loginMode === 'OTP' && { color: '#ffffff' }]}>OTP Login</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setLoginMode('PASSWORD')}
              style={[styles.modeTab, loginMode === 'PASSWORD' && { backgroundColor: theme.colors.primary }]}
            >
              <Text style={[styles.modeText, loginMode === 'PASSWORD' && { color: '#ffffff' }]}>Password</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Input 
              label="Mobile Number"
              placeholder="10-digit number"
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={setPhone}
              iconLeft={<Phone size={20} />}
            />

            {loginMode === 'PASSWORD' && (
              <Input 
                label="Password"
                placeholder="Enter your password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                iconLeft={<Lock size={20} />}
              />
            )}

            <Button 
              title={loginMode === 'OTP' ? 'Send Verification Code' : 'Sign In'}
              onPress={handleAction}
              loading={loading}
              style={styles.actionButton}
            />

            {loginMode === 'PASSWORD' && (
              <TouchableOpacity 
                style={styles.forgotPassword}
                onPress={() => navigation.navigate('ForgotPassword', { role, prefillPhone: phone })}
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 16 : 16,
  },
  backButton: {
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
  header: {
    marginTop: 16,
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    textTransform: 'capitalize',
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceMuted || '#f1f4f8',
    borderRadius: 14,
    padding: 4,
    marginBottom: 32,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  modeText: {
    color: theme.colors.textDim,
    fontWeight: '700',
    fontSize: 14,
  },
  form: {
    flex: 1,
  },
  actionButton: {
    marginTop: 16,
  },
  forgotPassword: {
    marginTop: 24,
    alignItems: 'center',
  },
  forgotText: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
});

export default LoginScreen;
