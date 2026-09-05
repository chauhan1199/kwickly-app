import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  StatusBar, Alert, TextInput, ActivityIndicator, Modal, Linking, Platform, KeyboardAvoidingView, AppState
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import AppBar from '../../components/AppBar';
import { walletService } from '../../services/walletService';
import { utrValidationError, isValidUtr } from '../../utils/upiValidation';
import { Wallet, Zap, Copy, CheckCircle2, Building2, ShieldCheck, X, Check, ExternalLink, ArrowRight, Shield, ChevronDown, ChevronUp } from 'lucide-react-native';
import { GooglePayIcon, PhonePeIcon, PaytmIcon, CredIcon, BhimIcon, AnyUpiIcon } from '../../components/ui/UpiBrandIcons';
import { nativeUpiService } from '../../services/nativeUpiService';

import UpiPaymentWaitingModal from '../../components/UpiPaymentWaitingModal';

const PRESETS = [100, 250, 500, 1000, 2000, 5000];

const WalletTopupScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user, fetchUser } = useAuth();
  const styles = createStyles(theme, isDarkMode);

  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [upiCheckoutModal, setUpiCheckoutModal] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [upiOrderData, setUpiOrderData] = useState(null);
  const [selectedUpiApp, setSelectedUpiApp] = useState('gpay');
  const [waitingModalVisible, setWaitingModalVisible] = useState(false);

  const handleInitiateTopup = async () => {
    const topupAmount = parseInt(amount);
    if (!topupAmount || topupAmount < 10) {
      return Alert.alert('Invalid Amount', 'Minimum topup is ₹10');
    }

    setProcessing(true);
    try {
      const payRes = await walletService.createPaymentOrder({
        amount: topupAmount,
        purpose: 'wallet_topup',
        paymentMethod: 'UPI'
      });

      const payData = payRes?.data?.data || {};
      const platformUpi = (payData.upiVpa || '').trim();
      const platformPayee = (payData.payeeName || 'Kwickly Admin').trim().replace(/\s+/g, ' ');
      const orderId = payData.razorpayOrderId || payData.upiOrderId || `upi_${Date.now()}`;
      const amtStr = Number(topupAmount).toFixed(2);
      const shortTr = `KWIK${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(-4)}`.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);

      if (!platformUpi) {
        throw new Error('Admin UPI ID is not configured. Please contact support.');
      }

      const orderPayload = {
        razorpayOrderId: orderId,
        upiOrderId: orderId,
        upiVpa: platformUpi,
        payeeName: platformPayee,
        bankDetails: payData.bankDetails || {},
        upiIntentUri: payData.upiIntentUri || `upi://pay?pa=${platformUpi}&pn=${encodeURIComponent(platformPayee)}&am=${amtStr}&cu=INR&tn=${encodeURIComponent('Kwickly Topup')}&tr=${shortTr}`,
        amount: topupAmount
      };

      setUpiOrderData(orderPayload);
      setSelectedUpiApp('gpay');
      setUpiCheckoutModal(true);
    } catch (e) {
      const errMsg = e?.response?.data?.message || e?.message || 'Failed to initialize topup';
      Alert.alert('Topup Unavailable', errMsg);
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenUpiApp = async (appKey = 'gpay') => {
    if (!upiOrderData) return;
    setSelectedUpiApp(appKey);

    try {
      // Close checkout selector and open real-time waiting modal
      setUpiCheckoutModal(false);
      setWaitingModalVisible(true);

      const result = await nativeUpiService.startUpiPayment({
        vpa: upiOrderData.upiVpa,
        name: upiOrderData.payeeName || 'Kwickly Admin',
        amount: upiOrderData.amount,
        txnRef: upiOrderData.razorpayOrderId,
        note: `Kwickly Topup ₹${upiOrderData.amount}`,
        appKey,
      });

      if (result?.isSuccessful && (result.approvalRefNo || result.txnId)) {
        await handleManualUtrVerification(result.approvalRefNo || result.txnId);
        await handlePaymentSuccess();
        return;
      }
      console.log('[UPI] Returned from UPI app. Waiting modal remains active for confirmation.');
    } catch (err) {
      console.warn('[UPI] App launch warning:', err.message);
      setWaitingModalVisible(false);
      setUpiCheckoutModal(false);
    }
  };

  const handleCopyUpiId = () => {
    if (upiOrderData?.upiVpa) {
      Clipboard.setString(upiOrderData.upiVpa);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2500);
    }
  };

  const handleManualUtrVerification = async (utr) => {
    if (!upiOrderData) return;
    const cleanUtr = (utr || '').toString().trim();
    if (!cleanUtr || !/^\d{12}$/.test(cleanUtr)) {
      throw new Error('Please enter a valid 12-digit UPI Reference (UTR) Number.');
    }
    const res = await walletService.verifyPayment({
      razorpayOrderId: upiOrderData.razorpayOrderId,
      upiTransactionId: cleanUtr,
      utrNumber: cleanUtr,
      purpose: 'wallet_topup',
      amount: upiOrderData.amount
    });
    return res?.data?.data;
  };

  const handlePaymentSuccess = async () => {
    setWaitingModalVisible(false);
    setUpiCheckoutModal(false);
    setAmount('');
    if (fetchUser) await fetchUser();
    navigation.goBack();
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
          onPress={handleInitiateTopup}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Zap size={20} color="#fff" />
              <Text style={styles.topupBtnText}>
                Top Up ₹{amount || 0}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.securityNote}>
          <Text style={styles.securityText}>
            🔒 100% Secure Payments via Admin Verified UPI & Instant Settlement.
          </Text>
        </View>
      </View>

      {/* UPI Checkout Modal */}
      <Modal visible={upiCheckoutModal} transparent animationType="slide" onRequestClose={() => !isVerifying && setUpiCheckoutModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <View style={styles.upiSheet}>
            <View style={styles.handle} />
            
            <View style={styles.upiHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Pay via UPI / NetBanking</Text>
                <Text style={styles.upiSubtitle}>Top-up Kwickly Wallet with instant credit</Text>
              </View>
              <TouchableOpacity onPress={() => !isVerifying && setUpiCheckoutModal(false)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            {/* Total Amount Pill */}
            <View style={styles.amountPill}>
              <Text style={styles.amountPillLabel}>Amount to Add</Text>
              <Text style={styles.amountPillValue}>₹{upiOrderData?.amount || 0}</Text>
            </View>

            {/* Quick UPI App Grid */}
            <Text style={styles.upiAppsHeading}>Choose UPI App</Text>
            <View style={styles.upiAppsGrid}>
              {[
                { key: 'gpay', name: 'Google Pay', icon: GooglePayIcon },
                { key: 'phonepe', name: 'PhonePe', icon: PhonePeIcon },
                { key: 'paytm', name: 'Paytm', icon: PaytmIcon },
                { key: 'cred', name: 'CRED', icon: CredIcon },
                { key: 'bhim', name: 'BHIM', icon: BhimIcon },
                { key: 'generic', name: 'Any UPI', icon: AnyUpiIcon },
              ].map((app) => {
                const IconComponent = app.icon;
                const isSelected = selectedUpiApp === app.key;
                return (
                  <TouchableOpacity
                    key={app.key}
                    style={[styles.upiAppBtn, isSelected && styles.upiAppBtnSelected]}
                    onPress={() => handleOpenUpiApp(app.key)}
                    activeOpacity={0.8}
                  >
                    <View style={{ marginBottom: 4 }}>
                      <IconComponent size={32} />
                    </View>
                    <Text style={[styles.upiAppLabel, isSelected && { color: '#6C47FF', fontWeight: '800' }]} numberOfLines={1}>
                      {app.name}
                    </Text>
                    {isSelected && (
                      <View style={styles.appCheckBadge}>
                        <Check size={10} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Pay via App Button */}
            <TouchableOpacity
              style={styles.confirmPayBtn}
              onPress={() => handleOpenUpiApp(selectedUpiApp || 'gpay')}
              activeOpacity={0.85}
            >
              <Zap size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.confirmPayBtnText}>
                Pay ₹{upiOrderData?.amount || 0} via {selectedUpiApp === 'gpay' ? 'Google Pay' : selectedUpiApp === 'phonepe' ? 'PhonePe' : selectedUpiApp === 'paytm' ? 'Paytm' : selectedUpiApp === 'cred' ? 'CRED' : selectedUpiApp === 'bhim' ? 'BHIM' : 'UPI App'}
              </Text>
              <ArrowRight size={18} color="#fff" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Real-time Bank Confirmation Waiting Modal */}
      <UpiPaymentWaitingModal
        visible={waitingModalVisible}
        onClose={() => setWaitingModalVisible(false)}
        onSuccess={handlePaymentSuccess}
        amount={upiOrderData?.amount || 0}
        orderId={upiOrderData?.razorpayOrderId}
        payeeName={upiOrderData?.payeeName}
        upiVpa={upiOrderData?.upiVpa}
        purpose="wallet_topup"
        onSubmitManualUtr={handleManualUtrVerification}
      />
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
  topupBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#6C47FF', paddingVertical: 16, borderRadius: 14 },
  topupBtnText:  { fontSize: 16, fontWeight: '800', color: '#fff' },
  securityNote:  { marginTop: 12, alignItems: 'center' },
  securityText:  { fontSize: 11, color: theme.colors.textDim, textAlign: 'center' },
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  upiSheet:      { backgroundColor: theme.colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 22, paddingBottom: Platform.OS === 'ios' ? 40 : 26 },
  handle:        { width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:    { fontSize: 20, fontWeight: '900', color: theme.colors.text },
  upiHeaderRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  upiSubtitle:   { fontSize: 12.5, color: theme.colors.textDim, marginTop: 2, fontWeight: '500' },
  closeBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' },
  amountPill:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#6C47FF12', borderWidth: 1, borderColor: '#6C47FF30', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 12, marginBottom: 16 },
  amountPillLabel:{ fontSize: 14, fontWeight: '700', color: theme.colors.text },
  amountPillValue:{ fontSize: 22, fontWeight: '900', color: '#6C47FF' },
  payeeCard:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.background, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 18 },
  payeeNameLabel:{ fontSize: 12, fontWeight: '700', color: theme.colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5 },
  payeeUpiText:  { fontSize: 14.5, fontWeight: '800', color: theme.colors.text, marginTop: 2 },
  copyBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#6C47FF18', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  copyBtnText:   { fontSize: 12, fontWeight: '800', color: '#6C47FF' },
  upiAppsHeading:{ fontSize: 13, fontWeight: '700', color: theme.colors.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  upiAppsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  upiAppBtn:     { width: '31%', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 16, backgroundColor: theme.colors.background, borderWidth: 1.5, borderColor: theme.colors.border, position: 'relative' },
  upiAppBtnSelected: { borderColor: '#6C47FF', backgroundColor: '#6C47FF0D' },
  upiAppEmoji:   { fontSize: 20, marginBottom: 4 },
  upiAppLabel:   { fontSize: 11, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
  appCheckBadge: { position: 'absolute', top: 5, right: 5, width: 16, height: 16, borderRadius: 8, backgroundColor: '#6C47FF', justifyContent: 'center', alignItems: 'center' },

  utrSection:    { marginBottom: 8 },
  utrHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  pulseDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  utrHeaderTitle:{ fontSize: 13.5, fontWeight: '800', color: theme.colors.text },
  utrHeaderSub:  { fontSize: 12, color: theme.colors.textDim, lineHeight: 17, marginBottom: 12 },
  utrInputBox:   { backgroundColor: theme.colors.background, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: '#6C47FF', marginBottom: 16 },
  utrInputLabel: { fontSize: 11.5, fontWeight: '800', color: '#6C47FF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  utrInput:      { fontSize: 16, fontWeight: '800', color: theme.colors.text, paddingVertical: 4, letterSpacing: 1 },
  utrHelpText:   { fontSize: 11, color: theme.colors.textDim, marginTop: 6, lineHeight: 15 },
  reopenRow:     { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  reopenBtnFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#6C47FF14', borderRadius: 12 },
  reopenText:    { fontSize: 13, fontWeight: '700', color: '#6C47FF' },

  confirmPayBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6C47FF', paddingVertical: 16, paddingHorizontal: 16, borderRadius: 16, shadowColor: '#6C47FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  confirmPayBtnText:{ fontSize: 14.5, fontWeight: '800', color: '#fff', textAlign: 'center' },
});

export default WalletTopupScreen;

