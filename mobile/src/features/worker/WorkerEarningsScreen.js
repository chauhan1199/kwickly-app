import React, { useState } from 'react';
import { 
  ScrollView, 
  View, 
  StyleSheet, 
  SafeAreaView, 
  Text, 
  TouchableOpacity,
  StatusBar,
  Modal,
  TouchableWithoutFeedback,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { ArrowDown, ArrowUp, Gift, Landmark, Smartphone, Briefcase, DollarSign, Wallet, ShieldAlert, History, PlusCircle, CreditCard, ChevronRight, CheckCircle2, Clock } from 'lucide-react-native';
import AppBar from '../../components/AppBar';

import { walletService } from '../../services/walletService';
import { workerService } from '../../services/workerService';
import api from '../../services/api';

const WorkerEarningsScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user, signOut } = useAuth();
  const styles = createStyles(theme, isDarkMode);

  const [wallet, setWallet] = useState({ balance: 0 });
  const [transactions, setTransactions] = useState([]);
  const [profile, setProfile] = useState(null);
  const [accounts, setAccounts] = useState([]);

  // Modals state
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dynamicPlans, setDynamicPlans] = useState([]);

  // Trial/Plan Calculation
  let daysLeft = 0;
  let isTrialActive = false;
  let isPlanActive = false;

  if (profile?.subscription?.expiryDate && new Date(profile.subscription.expiryDate) > new Date()) {
    isPlanActive = true;
    daysLeft = Math.ceil((new Date(profile.subscription.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
  } else {
    const registrationDate = new Date(profile?.createdAt || Date.now());
    const trialDurationDays = 180;
    const trialEndDate = new Date(registrationDate.getTime() + trialDurationDays * 24 * 60 * 60 * 1000);
    daysLeft = Math.max(0, Math.ceil((trialEndDate - new Date()) / (1000 * 60 * 60 * 24)));
    isTrialActive = daysLeft > 0;
  }
  const isActive = isTrialActive || isPlanActive;

  React.useEffect(() => {
    fetchWalletAndProfile();
  }, []);

  const fetchWalletAndProfile = async () => {
    try {
      const [walletRes, profileRes, settingsRes] = await Promise.all([
        walletService.getWallet(),
        workerService.getWorkerProfile(),
        api.get('/settings/public').catch(() => null)
      ]);
      
      if (settingsRes?.data?.status === 'success') {
        const plansData = settingsRes.data.data.subscriptionPlans || [];
        const formatted = plansData.map(p => ({
          id: p.id || p.label,
          title: p.label || p.name,
          sub: p.durationDays ? `${p.durationDays} days` : 'Custom duration',
          price: `₹${p.price || 0}`
        }));
        const tlist = walletRes.data.data.transactions || [];
        const mappedTxns = tlist.map(t => ({
          id: t._id,
          txnId: t._id.slice(-8).toUpperCase(),
          title: t.description || 'Transaction',
          time: new Date(t.createdAt).toLocaleString(),
          amount: t.amount,
          type: ['TOPUP', 'ORDER_CREDIT', 'ADJUSTMENT', 'JOB_CREDIT', 'REFERRAL_BONUS'].includes(t.type) ? 'credit' : 'debit',
          status: t.status
        }));
        setTransactions(mappedTxns);
        setDynamicPlans(formatted);
        if (formatted.length > 0 && selectedPlan === 'yearly') {
            setSelectedPlan(formatted[0].id);
        }
      }

      if (walletRes.data.status === 'success') {
        setWallet({ balance: walletRes.data.data.balance || 0 });
      }
      
      if (profileRes.data.status === 'success') {
        const wProfile = profileRes.data.data;
        setProfile(wProfile);
        
        const accs = [];
        if (wProfile?.wallet?.bankDetails?.accountNumber) {
          accs.push({
            id: 'bank',
            type: 'bank',
            name: wProfile.wallet.bankDetails.bankName || 'Bank Account',
            detail: `${wProfile.wallet.bankDetails.accountNumber} (IFSC: ${wProfile.wallet.bankDetails.ifscCode})`
          });
        }
        if (wProfile?.wallet?.upiDetails?.upiId) {
          accs.push({
            id: 'upi',
            type: 'upi',
            name: 'UPI Account',
            detail: wProfile.wallet.upiDetails.upiId
          });
        }
        setAccounts(accs);
        if (accs.length > 0) {
          if (!selectedPayout) setSelectedPayout(accs[0].id);
          if (!topUpMethod || topUpMethod === 'UPI' || topUpMethod === 'BANK') setTopUpMethod(accs[0].id);
        }
      }
    } catch (e) {
      console.log('Failed to fetch data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToPay = async () => {
    if (!selectedPlan) {
      Alert.alert("Error", "Please select a plan to continue.");
      return;
    }
    try {
      setLoading(true);
      const res = await api.post('/subscriptions/subscribe', { planId: selectedPlan });
      if (res.data?.status === 'success') {
        Alert.alert("Success", "Your subscription plan has been successfully updated!");
        setPlanModalVisible(false);
        fetchWalletAndProfile();
      }
    } catch (error) {
      console.log('Topup failed:', error);
      Alert.alert("Error", error.response?.data?.message || "Failed to process subscription top up.");
    } finally {
      setLoading(false);
    }
  };

  // Data state
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpMethod, setTopUpMethod] = useState('UPI');
  


  const handleSubmitWithdrawal = async () => {
    if (!withdrawAmount || isNaN(withdrawAmount)) {
      Alert.alert("Error", "Please enter a valid amount.");
      return;
    }
    if (!selectedPayout) {
      Alert.alert("Error", "Please select a payout destination (Bank or UPI).");
      return;
    }
    
    try {
      const payoutLabel = selectedPayout === 'bank' ? 'Bank Account' : 'UPI ID';
      const res = await walletService.requestWithdrawal(Number(withdrawAmount), payoutLabel);
      if (res.data.status === 'success') {
        Alert.alert("Success", "Withdrawal request submitted ✅\n\nIt will be processed in 1-2 business days.");
        setWithdrawAmount('');
        setSelectedPayout(null);
        setWithdrawModalVisible(false);
        fetchWalletAndProfile();
      }
    } catch (e) {
      Alert.alert("Error", e.response?.data?.message || "Failed to submit withdrawal request.");
    }
  };

  const handleTopup = async () => {
    if (!topUpAmount || isNaN(topUpAmount) || Number(topUpAmount) <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount.");
      return;
    }
    const selectedAcc = accounts.find(a => a.id === topUpMethod) || accounts[0];
    if (!selectedAcc && accounts.length === 0) {
      Alert.alert("No Payment Method", "Please add a payment method in settings.");
      return;
    }
    try {
      setLoading(true);
      const res = await walletService.topupWallet(Number(topUpAmount), { method: selectedAcc ? selectedAcc.type : 'UPI', accountId: selectedAcc ? selectedAcc.id : undefined });
      if (res.data.status === 'success') {
        Alert.alert("Success", "Wallet topped up successfully ✅");
        setTopUpModalVisible(false);
        setTopUpAmount('');
        fetchWalletAndProfile();
      }
    } catch (e) {
      Alert.alert("Error", "Failed to top up wallet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      <AppBar title="Earnings & Plan" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>₹{wallet.balance.toFixed(2)}</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={[styles.withdrawBtn, { backgroundColor: '#0284c7' }]} onPress={() => setTopUpModalVisible(true)}>
              <Text style={styles.withdrawBtnText}>+ Top Up</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.withdrawBtn} onPress={() => setWithdrawModalVisible(true)}>
              <Text style={styles.withdrawBtnText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Free Trial / Plan Card */}
        <View style={styles.trialCard}>
          <View style={styles.trialHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Gift size={20} color={isActive ? "#d97706" : "#dc2626"} style={{ marginRight: 8 }} />
              <Text style={styles.trialTitle}>
                {isPlanActive ? 'Plan Active' : isTrialActive ? 'Free Trial Active' : 'Trial Expired'}
              </Text>
            </View>
            <View style={[styles.trialBadge, !isActive && { backgroundColor: '#fee2e2' }]}>
              <Text style={[styles.trialBadgeText, !isActive && { color: '#dc2626' }]}>
                {isActive ? `${daysLeft} Days Left` : '0 Days Left'}
              </Text>
            </View>
          </View>
          <Text style={styles.trialDesc}>
            {isPlanActive 
              ? 'Your subscription is currently active. Top up your plan to extend.'
              : isTrialActive 
                ? 'Your 6 months free trial is currently active. Top up your plan to extend.'
                : 'Your free trial has ended. Please select a plan and top up to continue getting jobs.'}
          </Text>
          <TouchableOpacity 
            style={styles.topUpBtn}
            onPress={() => setPlanModalVisible(true)}
          >
            <Text style={styles.topUpBtnText}>Select Plan & Top Up</Text>
          </TouchableOpacity>
        </View>

        {/* Weekly Earnings Chart */}
        <Text style={styles.sectionTitle}>Weekly Earnings</Text>
        <View style={styles.chartCard}>
          <View style={styles.chartBars}>
            <View style={styles.chartCol}>
              <View style={[styles.chartBar, { height: '30%' }]} />
              <Text style={styles.chartLabel}>Mon</Text>
            </View>
            <View style={styles.chartCol}>
              <View style={[styles.chartBar, { height: '50%' }]} />
              <Text style={styles.chartLabel}>Tue</Text>
            </View>
            <View style={styles.chartCol}>
              <View style={[styles.chartBar, { height: '20%' }]} />
              <Text style={styles.chartLabel}>Wed</Text>
            </View>
            <View style={styles.chartCol}>
              <View style={[styles.chartBar, { height: '80%' }]} />
              <Text style={styles.chartLabel}>Thu</Text>
            </View>
            <View style={styles.chartCol}>
              <View style={[styles.chartBar, { height: '60%', backgroundColor: theme.colors.primary }]} />
              <Text style={styles.chartLabel}>Fri</Text>
            </View>
            <View style={styles.chartCol}>
              <View style={[styles.chartBar, { height: '10%' }]} />
              <Text style={styles.chartLabel}>Sat</Text>
            </View>
            <View style={styles.chartCol}>
              <View style={[styles.chartBar, { height: '40%' }]} />
              <Text style={styles.chartLabel}>Sun</Text>
            </View>
          </View>
        </View>

        {/* Recent Transactions */}
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        
        <View style={styles.transactionsList}>
          {transactions.map((t) => {
            const isCredit = t.type === 'credit';
            const amountPrefix = isCredit ? '+' : '-';
            const colorClass = isCredit ? '#059669' : '#dc2626';
            const bgClass = isCredit ? '#e0f2fe' : '#fee2e2';
            return (
              <TouchableOpacity 
                key={t.id} 
                style={styles.transactionCard}
                onPress={() => {
                  setSelectedTransaction(t);
                  setTransactionModalVisible(true);
                }}
              >
                <View style={styles.txLeft}>
                  <View style={[styles.txIconBox, { backgroundColor: bgClass }]}>
                    {isCredit ? (
                      <ArrowDown size={18} color="#0284c7" />
                    ) : (
                      <ArrowUp size={18} color="#dc2626" />
                    )}
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txTitle}>{t.title}</Text>
                    <Text style={styles.txTime}>
                      {t.time} • <Text style={{ color: t.status === 'PENDING' ? '#f59e0b' : (t.status === 'REJECTED' ? '#dc2626' : '#059669') }}>{t.status}</Text>
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.txAmount, { color: colorClass }]}>
                    {amountPrefix}₹{t.amount}
                  </Text>
                  {t.status === 'PENDING' && (
                    <Text style={{ fontSize: 10, color: '#f59e0b', fontWeight: '800', marginTop: 2 }}>PENDING</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          {transactions.length === 0 && !loading && (
            <Text style={{ textAlign: 'center', marginTop: 20, color: theme.colors.textDim }}>No recent transactions found.</Text>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Top Up Plan Modal */}
      <Modal
        visible={planModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPlanModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setPlanModalVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.bottomSheet}>
              <View style={styles.sheetHeaderHandle} />
              <Text style={styles.sheetTitle}>Top Up Plan</Text>
              <Text style={styles.sheetSub}>Select a plan to extend your validity</Text>

              <View style={styles.planList}>
                {dynamicPlans.map((plan) => (
                  <TouchableOpacity 
                    key={plan.id}
                    style={[styles.planCard, selectedPlan === plan.id && styles.planCardActive]}
                    onPress={() => setSelectedPlan(plan.id)}
                  >
                    <View>
                      <Text style={[styles.planTitle, selectedPlan === plan.id && styles.planTextActive]}>{plan.title}</Text>
                      <Text style={[styles.planSub, selectedPlan === plan.id && styles.planSubActive]}>{plan.sub}</Text>
                    </View>
                    <Text style={[styles.planPrice, selectedPlan === plan.id && styles.planTextActive]}>{plan.price}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Button title={loading ? "Processing..." : "Proceed to Pay"} disabled={loading} onPress={handleProceedToPay} />
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Withdraw Funds Modal */}
      <Modal
        visible={withdrawModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={{ flex: 1, width: '100%' }} 
            activeOpacity={1} 
            onPress={() => setWithdrawModalVisible(false)}
          >
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              <TouchableWithoutFeedback>
                <View style={[styles.bottomSheet, { maxHeight: '95%' }]}>
                  <View style={styles.sheetHeaderHandle} />
                  <Text style={styles.sheetTitle}>Withdraw Funds</Text>
                  <Text style={styles.sheetSub}>Select destination account</Text>

                  <ScrollView style={styles.accountsList} showsVerticalScrollIndicator={false}>
                    {accounts.map(acc => (
                      <TouchableOpacity 
                        key={acc.id}
                        style={[styles.accountCard, selectedPayout === acc.id && styles.accountCardPrimary]}
                        onPress={() => setSelectedPayout(acc.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.accountLeft}>
                          <View style={[styles.accountIconBox, { width: 36, height: 36, borderRadius: 18 }]}>
                            {acc.type === 'bank' ? <Landmark size={18} color="#0d9488" /> : <Smartphone size={18} color="#e11d48" />}
                          </View>
                          <View style={styles.accountInfo}>
                            <Text style={[styles.accountName, { fontSize: 14 }]}>{acc.name}</Text>
                            <Text style={[styles.accountDetail, { fontSize: 12 }]}>{acc.detail}</Text>
                          </View>
                        </View>
                        {selectedPayout === acc.id && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.primary }} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {accounts.length === 0 && (
                    <TouchableOpacity style={[styles.addAccountBtn, { paddingVertical: 12, marginBottom: 16 }]} onPress={() => { setWithdrawModalVisible(false); navigation.navigate('Profile'); }}>
                      <Text style={styles.addAccountBtnText}>+ Add Payment Method</Text>
                    </TouchableOpacity>
                  )}

                  {/* Amount Input */}
                  <TextInput
                    style={[styles.amountInput, { fontSize: 24, textAlign: 'center', height: 70, marginTop: 10 }]}
                    placeholder="₹0"
                    placeholderTextColor={theme.colors.textDim}
                    keyboardType="numeric"
                    value={withdrawAmount}
                    onChangeText={setWithdrawAmount}
                  />
                  <Text style={[styles.processingNote, { textAlign: 'center', marginTop: 8 }]}>Processing time: 1-2 business days</Text>

                  <View style={{marginTop: 16}}>
                    <Button title="Submit Request" onPress={handleSubmitWithdrawal} />
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Transaction Details Modal */}
      <Modal
        visible={transactionModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setTransactionModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlayCenter} 
          activeOpacity={1} 
          onPress={() => setTransactionModalVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.centerModal}>
              {selectedTransaction && (
                <>
                  <View style={[styles.txIconBoxLarge, { backgroundColor: ['JOB_CREDIT', 'TOPUP', 'REFERRAL_BONUS', 'ADJUSTMENT'].includes(selectedTransaction.type) ? '#e0f2fe' : '#fee2e2' }]}>
                    {['JOB_CREDIT', 'TOPUP', 'REFERRAL_BONUS', 'ADJUSTMENT'].includes(selectedTransaction.type) ? (
                      <ArrowDown size={32} color="#0284c7" />
                    ) : (
                      <ArrowUp size={32} color="#dc2626" />
                    )}
                  </View>
                  
                  <Text style={styles.txDetailTitle}>{selectedTransaction.description || selectedTransaction.type}</Text>
                  <Text style={[styles.txDetailAmount, { color: ['JOB_CREDIT', 'TOPUP', 'REFERRAL_BONUS', 'ADJUSTMENT'].includes(selectedTransaction.type) ? '#059669' : '#dc2626' }]}>
                    {['JOB_CREDIT', 'TOPUP', 'REFERRAL_BONUS', 'ADJUSTMENT'].includes(selectedTransaction.type) ? '+' : '-'}₹{selectedTransaction.amount}
                  </Text>
                  
                  <View style={styles.txDetailInfoBox}>
                    <View style={styles.txDetailRow}>
                      <Text style={styles.txDetailLabel}>Status</Text>
                      <Text style={[styles.txDetailValue, { color: selectedTransaction.status === 'PENDING' ? '#f59e0b' : (selectedTransaction.status === 'REJECTED' ? '#dc2626' : '#059669'), fontWeight: '700' }]}>
                        {selectedTransaction.status || 'COMPLETED'}
                      </Text>
                    </View>
                    <View style={styles.txDetailRow}>
                      <Text style={styles.txDetailLabel}>Date</Text>
                      <Text style={styles.txDetailValue}>{new Date(selectedTransaction.createdAt).toLocaleString()}</Text>
                    </View>
                    <View style={styles.txDetailRow}>
                      <Text style={styles.txDetailLabel}>Transaction ID</Text>
                      <Text style={styles.txDetailValue}>{selectedTransaction._id ? selectedTransaction._id.slice(-8) : 'N/A'}</Text>
                    </View>
                  </View>

                  <View style={{flexDirection: 'row', gap: 12, marginTop: 20}}>
                    <TouchableOpacity 
                      style={[styles.downloadBtn, { flex: 1 }]}
                      onPress={() => {
                        Alert.alert("Success", "Receipt downloaded successfully! 📄");
                        setTransactionModalVisible(false);
                      }}
                    >
                      <Text style={styles.downloadBtnText}>Download</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.closeBtn, { flex: 1 }]}
                      onPress={() => setTransactionModalVisible(false)}
                    >
                      <Text style={styles.closeBtnText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Top Up Wallet Modal */}
      <Modal
        visible={topUpModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setTopUpModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={{ flex: 1, width: '100%' }} 
            activeOpacity={1} 
            onPress={() => setTopUpModalVisible(false)}
          >
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              <TouchableWithoutFeedback>
                <View style={styles.bottomSheet}>
                  <View style={styles.sheetHeaderHandle} />
                  <Text style={styles.sheetTitle}>Top Up Wallet</Text>
                  <Text style={styles.sheetSub}>Select payment method and enter amount</Text>

                  {/* Payment Method Selection */}
                  {accounts.length > 0 ? (
                    <ScrollView style={{ maxHeight: 160, marginBottom: 16 }} showsVerticalScrollIndicator={false}>
                      {accounts.map(acc => (
                        <TouchableOpacity 
                          key={acc.id} 
                          style={[styles.accountCard, topUpMethod === acc.id && styles.accountCardPrimary, { padding: 12, marginBottom: 8 }]}
                          onPress={() => setTopUpMethod(acc.id)}
                        >
                          <View style={styles.accountLeft}>
                            <View style={[styles.accountIconBox, { width: 36, height: 36, borderRadius: 18 }]}>
                              {acc.type === 'bank' ? <Landmark size={18} color="#0d9488" /> : <Smartphone size={18} color="#e11d48" />}
                            </View>
                            <View style={styles.accountInfo}>
                              <Text style={[styles.accountName, { fontSize: 14 }]}>{acc.name}</Text>
                              <Text style={[styles.accountDetail, { fontSize: 12 }]}>{acc.detail}</Text>
                            </View>
                          </View>
                          {topUpMethod === acc.id && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.primary }} />}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : (
                    <TouchableOpacity style={[styles.addAccountBtn, { paddingVertical: 12, marginBottom: 16 }]} onPress={() => { setTopUpModalVisible(false); navigation.navigate('Profile'); }}>
                      <Text style={styles.addAccountBtnText}>+ Add Payment Method</Text>
                    </TouchableOpacity>
                  )}

                  <TextInput
                    style={[styles.amountInput, { fontSize: 24, textAlign: 'center', height: 70 }]}
                    placeholder="₹0"
                    placeholderTextColor={theme.colors.textDim}
                    keyboardType="numeric"
                    value={topUpAmount}
                    onChangeText={setTopUpAmount}
                  />

                  {/* Quick Amounts */}
                  <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
                    {[100, 500, 1000].map(amt => (
                      <TouchableOpacity key={amt} style={styles.quickAmtBtn} onPress={() => setTopUpAmount(amt.toString())}>
                        <Text style={styles.quickAmtText}>+₹{amt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={{marginTop: 16}}>
                    <Button title={loading ? "Processing..." : "Proceed to Pay"} disabled={loading} onPress={handleTopup} />
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },
  balanceCard: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  chartCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 24,
    height: 180,
    justifyContent: 'flex-end'
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: '100%'
  },
  chartCol: {
    alignItems: 'center',
    width: 30,
    height: 120,
    justifyContent: 'flex-end'
  },
  chartBar: {
    width: 12,
    backgroundColor: theme.colors.primary + '40', // 40% opacity primary
    borderRadius: 6,
    marginBottom: 8
  },
  chartLabel: {
    fontSize: 12,
    color: theme.colors.textDim,
    fontWeight: '600'
  },
  balanceLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  balanceValue: {
    color: 'white',
    fontSize: 40,
    fontWeight: '900',
    marginTop: 8,
    marginBottom: 20,
  },
  withdrawBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 24,
  },
  withdrawBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  trialCard: {
    backgroundColor: '#f0fdfa', // Light teal tint
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    marginBottom: 30,
  },
  trialHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trialTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  trialBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trialBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  trialDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 16,
  },
  topUpBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  topUpBtnText: {
    color: '#001016',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 16,
  },
  transactionsList: {
    gap: 12,
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txInfo: {
    marginLeft: 12,
  },
  txTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  txTime: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    width: '100%'
  },
  bottomSheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  sheetHeaderHandle: {
    width: 40,
    height: 5,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.text,
  },
  sheetSub: {
    fontSize: 14,
    color: theme.colors.textDim,
    marginTop: 4,
    marginBottom: 24,
  },
  planList: {
    gap: 12,
    marginBottom: 24,
  },
  planCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  planCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.background,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  planTextActive: {
    color: theme.colors.primary,
  },
  planSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 4,
  },
  planSubActive: {
    color: theme.colors.primary + 'CC',
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.text,
  },
  accountsList: {
    maxHeight: 280,
    marginBottom: 20,
  },
  accountCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  accountCardPrimary: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '0A',
  },
  accountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accountIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ccfbf1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountInfo: {
    marginLeft: 12,
    flex: 1,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  accountDetail: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  accountRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  primaryBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  primaryBadgeText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '800',
  },
  setPrimaryBtn: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  setPrimaryBtnText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deleteBtnText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '700',
  },
  editBtn: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  editBtnText: {
    color: '#0284c7',
    fontSize: 11,
    fontWeight: '700',
  },
  addAccountBtn: {
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  addAccountBtnText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  amountInput: {
    width: '100%',
    height: 56,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  processingNote: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centerModal: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  txIconBoxLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  txDetailTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  txDetailAmount: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 24,
  },
  txDetailInfoBox: {
    width: '100%',
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  txDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  txDetailLabel: {
    fontSize: 14,
    color: theme.colors.textDim,
    fontWeight: '500',
  },
  txDetailValue: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '600',
  },
  txDetailValueSuccess: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '800',
  },
  downloadBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  downloadBtnText: {
    color: '#001016',
    fontSize: 15,
    fontWeight: '800',
  },
  closeBtn: {
    backgroundColor: theme.colors.background,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  closeBtnText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  }
});

export default WorkerEarningsScreen;
