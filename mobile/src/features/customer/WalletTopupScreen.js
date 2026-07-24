import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  StatusBar, Alert, TextInput, ActivityIndicator
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import AppBar from '../../components/AppBar';
import { walletService } from '../../services/walletService';
import { RAZORPAY_LOGO_URL } from '../../config/env';
import Razorpay from 'react-native-razorpay';
import { Wallet, CreditCard, Zap, Check } from 'lucide-react-native';

const PRESETS = [100, 200, 500, 1000, 2000, 5000];

const WalletTopupScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user, fetchUser } = useAuth();
  const styles = createStyles(theme, isDarkMode);

  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleTopup = async () => {
    const topupAmount = parseInt(amount);
    if (!topupAmount || topupAmount < 10) {
      return Alert.alert('Invalid Amount', 'Minimum topup is ₹10');
    }

    setProcessing(true);
    try {
      // Create Razorpay order for topup
      const payRes = await walletService.createPaymentOrder({
        amount: topupAmount,
        purpose: 'wallet_topup'
      });

      if (payRes.data?.status !== 'success') {
        throw new Error('Failed to create payment order');
      }

      const { razorpayOrderId, keyId } = payRes.data.data;

      const options = {
        description: `Kwickly Wallet Topup ₹${topupAmount}`,
        image: RAZORPAY_LOGO_URL,
        currency: 'INR',
        key: keyId,
        amount: topupAmount * 100,
        order_id: razorpayOrderId,
        name: 'Kwickly',
        prefill: {
          contact: user?.phone || '',
          email: user?.email || ''
        },
        theme: { color: '#0e9aa7' }
      };

      try {
        const razorpayResponse = await Razorpay.open(options);

        // Verify and credit wallet
        const verifyRes = await walletService.verifyPayment({
          razorpayOrderId: razorpayResponse.razorpay_order_id,
          razorpayPaymentId: razorpayResponse.razorpay_payment_id,
          razorpaySignature: razorpayResponse.razorpay_signature,
          purpose: 'wallet_topup',
          amount: topupAmount
        });

        if (verifyRes.data?.status === 'success') {
          if (fetchUser) await fetchUser();
          Alert.alert('Topup Successful! 🎉', `₹${topupAmount} has been added to your wallet.`, [
            { text: 'OK', onPress: () => navigation.goBack() }
          ]);
        }
      } catch (razorpayError) {
        if (razorpayError?.code === 0) {
          Alert.alert('Cancelled', 'Payment was cancelled');
        } else {
          Alert.alert('Payment Failed', razorpayError?.description || 'Payment failed');
        }
      }
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to process topup');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      <AppBar title="Top Up Wallet" packageRoute="CustomerShopOrders" showBack={true} />

      {/* Current Balance */}
      <View style={styles.balanceCard}>
        <Wallet size={28} color={theme.colors.primary} />
        <View style={styles.balanceInfo}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>₹{user?.wallet?.balance || 0}</Text>
        </View>
      </View>

      {/* Amount Input */}
      <View style={styles.inputSection}>
        <Text style={styles.sectionTitle}>Enter Amount</Text>
        <View style={styles.amountInput}>
          <Text style={styles.rupeeSymbol}>₹</Text>
          <TextInput
            style={styles.amountField}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={theme.colors.textDim}
            keyboardType="numeric"
            maxLength={6}
          />
        </View>
      </View>

      {/* Preset Amounts */}
      <View style={styles.presetsSection}>
        <Text style={styles.sectionTitle}>Quick Select</Text>
        <View style={styles.presetsGrid}>
          {PRESETS.map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.presetBtn, amount === String(p) && styles.presetBtnActive]}
              onPress={() => setAmount(String(p))}
            >
              <Text style={[styles.presetText, amount === String(p) && styles.presetTextActive]}>
                ₹{p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Topup Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.topupBtn, processing && { opacity: 0.6 }]}
          disabled={processing || !amount || parseInt(amount) < 10}
          onPress={handleTopup}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#001016" />
          ) : (
            <>
              <Zap size={20} color="#001016" />
              <Text style={styles.topupBtnText}>
                Top Up ₹{amount || 0}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.securityNote}>
          <Text style={styles.securityText}>
            🔒 Payments secured by Razorpay. Your card details are never stored.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container:     { flex: 1, backgroundColor: theme.colors.background },
  balanceCard:   { flexDirection: 'row', alignItems: 'center', gap: 16, margin: 16, padding: 20, backgroundColor: theme.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border },
  balanceInfo:   { flex: 1 },
  balanceLabel:  { fontSize: 13, color: theme.colors.textDim, fontWeight: '600' },
  balanceValue:  { fontSize: 28, fontWeight: '900', color: theme.colors.text, marginTop: 4 },
  inputSection:  { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle:  { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },
  amountInput:   { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 16, borderWidth: 2, borderColor: theme.colors.border, paddingHorizontal: 20 },
  rupeeSymbol:   { fontSize: 24, fontWeight: '800', color: theme.colors.primary },
  amountField:   { flex: 1, fontSize: 32, fontWeight: '800', color: theme.colors.text, paddingVertical: 16, marginLeft: 8 },
  presetsSection:{ marginHorizontal: 16, marginBottom: 16 },
  presetsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  presetBtn:     { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  presetBtnActive:{ borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' },
  presetText:    { fontSize: 15, fontWeight: '700', color: theme.colors.textDim },
  presetTextActive:{ color: theme.colors.primary },
  footer:        { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 24, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border },
  topupBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.colors.primary, paddingVertical: 16, borderRadius: 14 },
  topupBtnText:  { fontSize: 16, fontWeight: '800', color: '#001016' },
  securityNote:  { marginTop: 12, alignItems: 'center' },
  securityText:  { fontSize: 11, color: theme.colors.textDim, textAlign: 'center' },
});

export default WalletTopupScreen;
