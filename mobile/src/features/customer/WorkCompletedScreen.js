import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';
import { jobService } from '../../services/jobService';

const WorkCompletedScreen = ({ route, navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  const { worker, job } = route.params || {};
  const workerName = worker?.name || job?.workerId?.name || 'Worker';

  const jobAmount = job?.payment?.amount || job?.price || 499;
  const platformFee = Math.round(jobAmount * 0.1);
  const workerEarning = jobAmount - platformFee;

  const [otp, setOtp] = useState('');
  const [paying, setPaying] = useState(false);

  const handlePayment = async (method) => {
    if (!otp || otp.length !== 4) {
      return Alert.alert('OTP Required', 'Please enter the 4-digit Completion OTP to authorize payment.');
    }

    setPaying(true);
    try {
      const res = await jobService.payJob(job?._id, { method, completionOtp: otp });
      if (res.data.status === 'success') {
        Alert.alert('Payment Successful', 'Your payment was processed and split securely.', [
          { text: 'OK', onPress: () => navigation.navigate('RateExperience', { worker: { name: workerName }, job }) }
        ]);
      }
    } catch (e) {
      Alert.alert('Payment Failed', e.response?.data?.message || 'Invalid OTP or network error.');
    } finally {
      setPaying(false);
    }
  };

  const styles = createStyles(theme, isDarkMode);

  // Use actual media if available
  const completionMedia = job?.completionDetails?.media?.length > 0 
    ? job.completionDetails.media 
    : ['✓ Before', '✓ After', '🎥 Video']; // Fallback for display if missing

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.appBarTitle} numberOfLines={1}>Work Completed</Text>
          <Text style={styles.appBarSub} numberOfLines={1}>Review & Pay</Text>
        </View>
        <TouchableOpacity onPress={toggleTheme} style={[styles.bellBtn, { marginRight: 4 }]}>
          <Text style={{fontSize: 16}}>{isDarkMode ? '🌙' : '☀️'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bellBtn}>
          <Text style={{fontSize: 16}}>🔔</Text>
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* Completion Media */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Completion media by {workerName}</Text>
          <View style={styles.mediaGrid}>
            {completionMedia.map((item, index) => (
              <LinearGradient key={index} colors={['#8b5cf6', '#06b6d4']} style={styles.mediaTileFilled}>
                <Text style={styles.mediaTileText}>
                  {item.startsWith('http') ? `Image ${index + 1}` : item}
                </Text>
              </LinearGradient>
            ))}
          </View>
        </View>

        {/* Invoice */}
        <View style={styles.card}>
          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceText}>Service charge</Text>
            <Text style={styles.invoiceTextBold}>₹{jobAmount}</Text>
          </View>
          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceMuted}>Platform fee (10% approx)</Text>
            <Text style={styles.invoiceMuted}>₹{platformFee}</Text>
          </View>
          
          <View style={styles.separator} />
          
          <View style={styles.invoiceRow}>
            <Text style={styles.totalText}>Total</Text>
            <Text style={styles.totalPrice}>₹{jobAmount}</Text>
          </View>
          
          <Text style={styles.autoSplitText}>
            Auto-split: Worker gets ₹{workerEarning} · Platform ₹{platformFee}
          </Text>
        </View>

        {/* Enter OTP */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Authorize Payment</Text>
          <Text style={styles.cardSub}>Enter the 4-digit Completion OTP to release funds.</Text>
          
          <TextInput
            style={styles.otpInput}
            placeholder="Enter OTP (e.g., 4729)"
            placeholderTextColor={theme.colors.textDim}
            keyboardType="numeric"
            maxLength={4}
            value={otp}
            onChangeText={setOtp}
            editable={!paying}
          />
        </View>

        {paying ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={{ marginTop: 10, color: theme.colors.text }}>Processing split payment securely...</Text>
          </View>
        ) : (
          <>
            {/* Payment Buttons */}
            <View style={styles.payGrid}>
              <TouchableOpacity 
                style={styles.walletBtn}
                onPress={() => handlePayment('CASH')}
              >
                <Text style={styles.walletBtnText}>💵 Pay via Cash</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.upiBtn}
                onPress={() => handlePayment('ONLINE')}
              >
                <Text style={styles.upiBtnText}>Pay Online ₹{jobAmount}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
  },
  backBtnText: {
    fontSize: 24,
    color: theme.colors.text,
    lineHeight: 28,
  },
  appBarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },
  appBarSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  bellBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: isDarkMode ? theme.colors.surface : '#f1f5f9',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 8,
    height: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 12,
  },
  cardSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginBottom: 12,
  },
  otpInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    textAlign: 'center',
    letterSpacing: 4,
  },
  mediaGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  mediaTileFilled: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaTileText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  invoiceText: {
    color: theme.colors.text,
    fontSize: 14,
  },
  invoiceTextBold: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  invoiceMuted: {
    color: theme.colors.textDim,
    fontSize: 13,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 10,
  },
  totalText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  totalPrice: {
    color: theme.colors.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  autoSplitText: {
    color: theme.colors.textDim,
    fontSize: 11,
    marginTop: 8,
  },
  payGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  walletBtn: {
    flex: 1,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  walletBtnText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  upiBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  upiBtnText: {
    color: '#001016',
    fontSize: 13,
    fontWeight: '800',
  },
  cardBtn: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cardBtnText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  }
});

export default WorkCompletedScreen;
