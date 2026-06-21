import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, StatusBar, Modal, TextInput,
  TouchableWithoutFeedback, KeyboardAvoidingView, Platform, Alert, FlatList, ActivityIndicator
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { Wallet, ArrowDown, ArrowUp, Plus, TrendingUp } from 'lucide-react-native';
import Razorpay from 'react-native-razorpay';
import LinearGradient from 'react-native-linear-gradient';
import AppBar from '../../components/AppBar';
import api from '../../services/api';
import { walletService } from '../../services/walletService';
import { useAuth } from '../../context/AuthContext';

const CustomerWalletScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { fetchUser } = useAuth();
  const styles = createStyles(theme, isDarkMode);

  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  
  const [addMoneyModal, setAddMoneyModal] = useState(false);
  const [txnModal, setTxnModal] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [topupAmount, setTopupAmount] = useState('');

  const QUICK_AMOUNTS = ['100', '250', '500', '1000'];

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const res = await walletService.getWallet();
      if (res.data.status === 'success') {
        const wallet = res.data.data;
        setBalance(wallet.balance || 0);
        // We'll treat the response transactions array or fetch transactions separately if not included.
        // Assuming the wallet payload includes recent transactions in `wallet.transactions` or similar.
        setTransactions(wallet.transactions || []);
      }
    } catch (e) {
      console.log('Failed to fetch wallet:', e);
    } finally {
      setLoading(false);
    }
  };

  const isCredit = (t) => ['JOB_CREDIT', 'ORDER_CREDIT', 'REFUND', 'REFERRAL_BONUS', 'TOPUP'].includes(t.type);

  const handleTopup = async () => {
    if (!topupAmount || isNaN(topupAmount) || Number(topupAmount) < 10) {
      return Alert.alert('Invalid', 'Minimum topup is ₹10.');
    }
    
    setIsProcessing(true);
    
    try {
      const amount = Number(topupAmount);

      // Create Razorpay order
      const payRes = await api.post('/payments/create-order', {
        amount,
        purpose: 'wallet_topup'
      });

      if (payRes.data?.status !== 'success') {
        throw new Error('Failed to create payment order');
      }

      const { razorpayOrderId, keyId } = payRes.data.data;

      const options = {
        description: `Kwickly Wallet Topup ₹${amount}`,
        image: 'https://kwickly.in/logo.png',
        currency: 'INR',
        key: keyId,
        amount: amount * 100,
        order_id: razorpayOrderId,
        name: 'Kwickly',
        prefill: { contact: user?.phone || '', email: user?.email || '' },
        theme: { color: '#0e9aa7' }
      };

      try {
        const razorpayResponse = await Razorpay.open(options);

        // Verify payment
        const verifyRes = await api.post('/payments/verify', {
          razorpayOrderId: razorpayResponse.razorpay_order_id,
          razorpayPaymentId: razorpayResponse.razorpay_payment_id,
          razorpaySignature: razorpayResponse.razorpay_signature,
          purpose: 'wallet_topup',
          amount
        });

        if (verifyRes.data?.status === 'success') {
          if (fetchUser) await fetchUser();
          fetchWallet();
          setAddMoneyModal(false);
          setTopupAmount('');
          Alert.alert('Topup Successful 🎉', `₹${amount} was securely added to your Kwickly Wallet!`);
        }
      } catch (razorpayError) {
        if (razorpayError?.code === 0) {
          // User cancelled - do nothing
        } else {
          Alert.alert('Payment Failed', razorpayError?.description || 'Payment failed. Please try again.');
        }
      }
    } catch (error) {
      console.log('Topup failed', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to add money. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const openTxn = (t) => { setSelectedTxn(t); setTxnModal(true); };

  const renderTxn = ({ item }) => (
    <TouchableOpacity style={styles.txCard} onPress={() => openTxn(item)} activeOpacity={0.8}>
      <View style={[styles.txIcon, { backgroundColor: isCredit(item) ? '#d1fae5' : '#fee2e2' }]}>
        {isCredit(item)
          ? <ArrowDown size={18} color="#059669" />
          : <ArrowUp size={18} color="#dc2626" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.txTitle}>{item.description}</Text>
        <Text style={styles.txDesc}>{new Date(item.createdAt || item.txnDate).toLocaleDateString()}</Text>
      </View>
      <Text style={[styles.txAmount, { color: isCredit(item) ? '#059669' : '#dc2626' }]}>
        {isCredit(item) ? '+' : '-'}₹{item.amount}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      <AppBar title="My Wallet" packageRoute="CustomerShopOrders" />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]}>

        {/* Balance Card */}
        <LinearGradient
          colors={['#0e9aa7', '#0a7a85']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <View style={styles.balanceCardInner}>
            <Wallet size={28} color="rgba(255,255,255,0.7)" />
            <Text style={styles.balanceLabel}>Kwickly Wallet</Text>
          </View>
          <Text style={styles.balanceAmount}>₹{balance.toLocaleString('en-IN')}</Text>
          <Text style={styles.balanceSub}>Available Balance</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddMoneyModal(true)}>
            <Plus size={16} color="#0e9aa7" />
            <Text style={styles.addBtnText}>Add Money</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <TrendingUp size={18} color="#059669" />
            <Text style={styles.statNum}>₹{transactions.filter(t => isCredit(t)).reduce((sum, t) => sum + t.amount, 0).toLocaleString('en-IN')}</Text>
            <Text style={styles.statLabel}>Total Credits</Text>
          </View>
          <View style={[styles.statBox, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: theme.colors.border }]}>
            <ArrowUp size={18} color="#dc2626" />
            <Text style={styles.statNum}>₹{transactions.filter(t => !isCredit(t)).reduce((sum, t) => sum + t.amount, 0).toLocaleString('en-IN')}</Text>
            <Text style={styles.statLabel}>Total Debits</Text>
          </View>
          <View style={styles.statBox}>
            <Wallet size={18} color={theme.colors.primary} />
            <Text style={styles.statNum}>₹{balance.toLocaleString('en-IN')}</Text>
            <Text style={styles.statLabel}>Balance</Text>
          </View>
        </View>

        {/* Transactions */}
        <Text style={styles.sectionTitle}>Transaction History</Text>
        <FlatList
          data={transactions}
          keyExtractor={i => i._id}
          renderItem={renderTxn}
          scrollEnabled={false}
          contentContainerStyle={{ gap: 10 }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: theme.colors.textDim, padding: 20 }}>No transactions found.</Text>}
        />

        <View style={{ height: 80 }} />
      </ScrollView>
      )}

      {/* Add Money Modal */}
      <Modal visible={addMoneyModal} transparent animationType="slide" onRequestClose={() => setAddMoneyModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setAddMoneyModal(false)}>
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              <TouchableWithoutFeedback>
                <View style={styles.sheet}>
                  <View style={styles.handle} />
                  <Text style={styles.sheetTitle}>Add Money</Text>
                  <Text style={styles.inputLabel}>Enter Amount</Text>
                  <View style={styles.amountInputRow}>
                    <Text style={styles.rupeeSym}>₹</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={topupAmount}
                      onChangeText={setTopupAmount}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={theme.colors.textDim}
                    />
                  </View>
                  <View style={styles.quickRow}>
                    {QUICK_AMOUNTS.map(a => (
                      <TouchableOpacity key={a} style={styles.quickBtn} onPress={() => setTopupAmount(a)}>
                        <Text style={styles.quickBtnText}>+₹{a}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[styles.payBtn, isProcessing && { opacity: 0.7 }]}
                    onPress={handleTopup}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#001016" />
                    ) : (
                      <Text style={styles.payBtnText}>Proceed to Pay</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Transaction Details Modal */}
      <Modal visible={txnModal} transparent animationType="fade" onRequestClose={() => setTxnModal(false)}>
        <TouchableOpacity style={styles.centerOverlay} activeOpacity={1} onPress={() => setTxnModal(false)}>
          <TouchableWithoutFeedback>
            <View style={styles.centerModal}>
              {selectedTxn && (
                <>
                  <View style={[styles.txIconLarge, { backgroundColor: isCredit(selectedTxn) ? '#d1fae5' : '#fee2e2' }]}>
                    {isCredit(selectedTxn) ? <ArrowDown size={32} color="#059669" /> : <ArrowUp size={32} color="#dc2626" />}
                  </View>
                  <Text style={styles.txDetailTitle}>{selectedTxn.description}</Text>
                  <Text style={[styles.txDetailAmt, { color: isCredit(selectedTxn) ? '#059669' : '#dc2626' }]}>
                    {isCredit(selectedTxn) ? '+' : '-'}₹{selectedTxn.amount}
                  </Text>
                  <View style={styles.txInfoBox}>
                    {[['Type', selectedTxn.type], ['Date', new Date(selectedTxn.createdAt || selectedTxn.txnDate).toLocaleString()], ['ID', selectedTxn._id.slice(-8)]].map(([k, v]) => (
                      <View key={k} style={styles.txInfoRow}>
                        <Text style={styles.txInfoKey}>{k}</Text>
                        <Text style={[styles.txInfoVal]}>{v}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity style={styles.downloadBtn} onPress={() => { setTxnModal(false); Alert.alert('Receipt downloaded! 📄'); }}>
                    <Text style={styles.downloadBtnText}>Download Receipt</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container:      { flex: 1, backgroundColor: theme.colors.background },
  scroll:         { padding: 20 },
  balanceCard:    { borderRadius: 28, padding: 28, marginBottom: 24, elevation: 8, shadowColor: '#0e9aa7', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10 },
  balanceCardInner:{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  balanceLabel:   { fontSize: 15, color: 'rgba(255,255,255,0.9)', fontWeight: '700' },
  balanceAmount:  { fontSize: 44, fontWeight: '900', color: '#fff', marginBottom: 4, letterSpacing: -1 },
  balanceSub:     { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 24, fontWeight: '500' },
  addBtn:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', alignSelf: 'flex-start', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  addBtnText:     { fontSize: 14, fontWeight: '800', color: '#0e9aa7' },
  statsRow:       { flexDirection: 'row', backgroundColor: theme.colors.surface, borderRadius: 24, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 32, paddingVertical: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  statBox:        { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 8 },
  statNum:        { fontSize: 17, fontWeight: '900', color: theme.colors.text },
  statLabel:      { fontSize: 12, color: theme.colors.textDim, fontWeight: '600' },
  sectionTitle:   { fontSize: 19, fontWeight: '800', color: theme.colors.text, marginBottom: 16 },
  txCard:         { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: theme.colors.border, gap: 14, marginBottom: 4 },
  txIcon:         { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  txTitle:        { fontSize: 15, fontWeight: '800', color: theme.colors.text, marginBottom: 4 },
  txDesc:         { fontSize: 13, color: theme.colors.textDim, fontWeight: '500' },
  txAmount:       { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:          { backgroundColor: theme.colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  handle:         { width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:     { fontSize: 22, fontWeight: '900', color: theme.colors.text, marginBottom: 20 },
  inputLabel:     { fontSize: 13, fontWeight: '600', color: theme.colors.textDim, marginBottom: 8 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: theme.colors.primary, borderRadius: 16, paddingHorizontal: 16, height: 60, marginBottom: 16 },
  rupeeSym:       { fontSize: 24, fontWeight: '900', color: theme.colors.text, marginRight: 8 },
  amountInput:    { flex: 1, fontSize: 28, fontWeight: '900', color: theme.colors.text },
  quickRow:       { flexDirection: 'row', gap: 10, marginBottom: 24 },
  quickBtn:       { flex: 1, paddingVertical: 10, backgroundColor: theme.colors.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  quickBtnText:   { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  payBtn:         { backgroundColor: theme.colors.primary, paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  payBtnText:     { fontSize: 16, fontWeight: '800', color: '#001016' },
  centerOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  centerModal:    { backgroundColor: theme.colors.surface, borderRadius: 24, padding: 24, width: '100%', alignItems: 'center' },
  txIconLarge:    { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  txDetailTitle:  { fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: 8, textAlign: 'center' },
  txDetailAmt:    { fontSize: 32, fontWeight: '900', marginBottom: 20 },
  txInfoBox:      { width: '100%', backgroundColor: theme.colors.background, borderRadius: 16, padding: 16, gap: 12, marginBottom: 20 },
  txInfoRow:      { flexDirection: 'row', justifyContent: 'space-between' },
  txInfoKey:      { fontSize: 13, color: theme.colors.textDim, fontWeight: '600' },
  txInfoVal:      { fontSize: 13, color: theme.colors.text, fontWeight: '700' },
  downloadBtn:    { backgroundColor: theme.colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  downloadBtnText:{ fontSize: 14, fontWeight: '800', color: '#001016' },
});

export default CustomerWalletScreen;
