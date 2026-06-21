import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import Theme from '../../constants/Theme';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Phone, Lock, ArrowLeft } from 'lucide-react-native';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const LoginScreen = ({ navigation, route }) => {
  const { role: initialRole = 'CUSTOMER', prefillPhone = '' } = route.params || {};
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.content}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color={Theme.colors.text} />
          </TouchableOpacity>

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
                  role === r ? { backgroundColor: Theme.colors.primary, borderWidth: 0 } : { backgroundColor: Theme.colors.card, borderWidth: 1, borderColor: Theme.colors.border },
                  { marginRight: r !== 'SHOP' ? 8 : 0, borderRadius: 20, paddingVertical: 8 }
                ]}
              >
                <Text style={[
                  styles.modeText, 
                  role === r ? { color: Theme.colors.white } : { color: Theme.colors.textDim },
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
              style={[styles.modeTab, loginMode === 'OTP' && styles.activeTab]}
            >
              <Text style={[styles.modeText, loginMode === 'OTP' && styles.activeModeText]}>OTP Login</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setLoginMode('PASSWORD')}
              style={[styles.modeTab, loginMode === 'PASSWORD' && styles.activeTab]}
            >
              <Text style={[styles.modeText, loginMode === 'PASSWORD' && styles.activeModeText]}>Password</Text>
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
              iconLeft={<Phone size={20} color={Theme.colors.textMuted} />}
            />

            {loginMode === 'PASSWORD' && (
              <Input 
                label="Password"
                placeholder="Enter your password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                iconLeft={<Lock size={20} color={Theme.colors.textMuted} />}
              />
            )}

            <Button 
              title={loginMode === 'OTP' ? 'Send Verification Code' : 'Sign In'}
              onPress={handleAction}
              loading={loading}
              style={styles.actionButton}
            />

            {loginMode === 'PASSWORD' && (
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginTop: Theme.spacing.md,
  },
  header: {
    marginTop: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxl,
  },
  title: {
    fontSize: Theme.typography.sizes.xxl,
    fontWeight: Theme.typography.weights.bold,
    color: Theme.colors.text,
    textTransform: 'capitalize',
  },
  subtitle: {
    fontSize: Theme.typography.sizes.md,
    color: Theme.colors.textMuted,
    marginTop: Theme.spacing.xs,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.lg,
    padding: 4,
    marginBottom: Theme.spacing.xl,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Theme.radius.md,
  },
  activeTab: {
    backgroundColor: Theme.colors.primary,
  },
  modeText: {
    color: Theme.colors.textDim,
    fontWeight: Theme.typography.weights.semiBold,
  },
  activeModeText: {
    color: Theme.colors.white,
  },
  form: {
    flex: 1,
  },
  actionButton: {
    marginTop: Theme.spacing.md,
  },
  forgotPassword: {
    marginTop: Theme.spacing.lg,
    alignItems: 'center',
  },
  forgotText: {
    color: Theme.colors.primary,
    fontWeight: Theme.typography.weights.medium,
  },
});

export default LoginScreen;
