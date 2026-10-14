import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { jobService } from '../../services/jobService';
import { getCurrentCoordinates } from '../../utils/currentLocation';

const WorkerArrivalOTPScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const androidHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const safeTop = Math.max(insets.top, androidHeight) > 0 ? Math.max(insets.top, androidHeight) : 16;
  const styles = createStyles(theme, isDarkMode, safeTop);
  
  const [otp, setOtp] = useState(['', '', '', '']);
  const inputs = useRef([]);

  const handleOtpChange = (value, index) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 3) {
      inputs.current[index + 1].focus();
    }
  };

  const handleKeyPress = (e, index) => {
    // Handle backspace to focus previous input
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1].focus();
    }
  };

  const { jobId } = route.params || {};
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    const fullOtp = otp.join('');
    if (fullOtp.length !== 4) return;
    
    setLoading(true);
    try {
      const currentCoordinates = await getCurrentCoordinates();
      const res = await jobService.startJob(jobId, { arrivalOtp: fullOtp, currentCoordinates });
      if (res.data.status === 'success') {
        navigation.replace('WorkerActiveJob', { jobId, job: res.data.data });
      }
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.appBarTitle}>Arrival OTP</Text>
          <Text style={styles.appBarSub}>Ask customer for the 4-digit code</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.content}
      >
        <View style={styles.centerBox}>
          <Text style={styles.iconLarge}>🔐</Text>
          
          <Text style={styles.mainTitle}>Enter Arrival OTP</Text>
          <Text style={styles.subTitle}>
            The customer has a 4-digit OTP — ask them to share it
          </Text>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={el => inputs.current[index] = el}
                style={styles.otpInput}
                keyboardType="number-pad"
                maxLength={1}
                value={digit}
                onChangeText={v => handleOtpChange(v, index)}
                onKeyPress={e => handleKeyPress(e, index)}
                placeholderTextColor={theme.colors.textDim}
              />
            ))}
          </View>

          <TouchableOpacity 
            style={[styles.verifyBtn, otp.join('').length === 4 ? styles.verifyBtnActive : null]}
            disabled={otp.join('').length !== 4 || loading}
            onPress={handleVerify}
          >
            <Text style={styles.verifyBtnText}>
              {loading ? 'Verifying...' : 'Verify & Start Job'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode, safeTop = 16) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  appBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: safeTop + 8, paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
    borderRadius: 18, backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
  },
  backBtnText: { fontSize: 24, color: theme.colors.text, lineHeight: 28 },
  appBarTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  appBarSub: { fontSize: 13, color: theme.colors.textDim },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  centerBox: {
    alignItems: 'center',
    paddingBottom: 80, // Offset for tab bar
  },
  iconLarge: {
    fontSize: 70,
    marginBottom: 20,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
  },
  subTitle: {
    fontSize: 14,
    color: theme.colors.textDim,
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 40,
  },
  otpInput: {
    width: 60,
    height: 60,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  verifyBtn: {
    backgroundColor: theme.colors.primary,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  verifyBtnText: {
    color: '#001016',
    fontSize: 16,
    fontWeight: '800',
  },
  
  
  tabText: { fontSize: 11, fontWeight: '600', color: theme.colors.textDim }
});

export default WorkerArrivalOTPScreen;
