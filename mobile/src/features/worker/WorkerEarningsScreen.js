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
import { ArrowDown, ArrowUp, Gift, Landmark, Smartphone } from 'lucide-react-native';
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
        setDynamicPlans(formatted);
        if (formatted.length > 0 && selectedPlan === 'yearly') {
            setSelectedPlan(formatted[0].id);
        }
      }

      if (walletRes.data.status === 'success') {
        setWallet({ balance: walletRes.data.data.balance || 0 });
        setTransactions(walletRes.data.data.transactions || []);
      }
      
      if (profileRes.data.status === 'success') {
        setProfile(profileRes.data.data);
      }
    } catch (e) {
      console.log('Failed to fetch data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Data state
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedPayout, setSelectedPayout] = useState(null);
  


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

  const { signIn } = useAuth(); // Assuming signIn is available to update user state

  const handleTopup = async () => {
    const plan = dynamicPlans.find(p => p.id === selectedPlan);
    if (!plan) return;
    const amount = Number(plan.price.replace('₹', ''));
    try {
      const res = await walletService.topupWallet(amount, { method: 'UPI' }, selectedPlan);
      if (res.data.status === 'success') {
        Alert.alert("Success", "Top up successful ✅");
        setPlanModalVisible(false);
        fetchWalletAndProfile();
      }
    } catch (e) {
      Alert.alert("Error", "Failed to top up wallet.");
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
          <TouchableOpacity style={styles.withdrawBtn} onPress={() => setWithdrawModalVisible(true)}>
            <Text style={styles.withdrawBtnText}>Withdraw</Text>
          </TouchableOpacity>
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
            const isCredit = ['JOB_CREDIT', 'TOPUP', 'REFERRAL_BONUS', 'ADJUSTMENT'].includes(t.type);
            const amountPrefix = isCredit ? '+' : '-';
            const colorClass = isCredit ? '#059669' : '#dc2626';
            const bgClass = isCredit ? '#e0f2fe' : '#fee2e2';
            return (
              <TouchableOpacity 
                key={t._id} 
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
                    <Text style={styles.txTitle}>{t.description || t.type}</Text>
                    <Text style={styles.txTime}>{new Date(t.createdAt).toLocaleString()}</Text>
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

              <Button title="Proceed to Pay" onPress={() => {}} />
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

                  {/* Payout Options */}
                  <ScrollView style={styles.accountsList} showsVerticalScrollIndicator={false}>
                    {profile?.wallet?.bankDetails?.accountNumber ? (
                      <TouchableOpacity 
                        style={[styles.accountCard, selectedPayout === 'bank' && styles.accountCardPrimary]}
                        onPress={() => setSelectedPayout('bank')}
                        activeOpacity={0.7}
                      >
                        <View style={styles.accountLeft}>
                          <View style={styles.accountIconBox}>
                            <Landmark size={20} color="#0d9488" />
                          </View>
                          <View style={styles.accountInfo}>
                            <Text style={styles.accountName}>{profile.wallet.bankDetails.bankName || 'Bank Account'}</Text>
                            <Text style={styles.accountDetail}>
                              {profile.wallet.bankDetails.accountNumber} (IFSC: {profile.wallet.bankDetails.ifscCode})
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ) : null}

                    {profile?.wallet?.upiId ? (
                      <TouchableOpacity 
                        style={[styles.accountCard, selectedPayout === 'upi' && styles.accountCardPrimary]}
                        onPress={() => setSelectedPayout('upi')}
                        activeOpacity={0.7}
                      >
                        <View style={styles.accountLeft}>
                          <View style={styles.accountIconBox}>
                            <Smartphone size={20} color="#e11d48" />
                          </View>
                          <View style={styles.accountInfo}>
                            <Text style={styles.accountName}>UPI ID</Text>
                            <Text style={styles.accountDetail}>{profile.wallet.upiId}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ) : null}

                    {(!profile?.wallet?.bankDetails?.accountNumber && !profile?.wallet?.upiId) && (
                      <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                        <Text style={{ color: theme.colors.textDim, marginBottom: 16 }}>No payment details added.</Text>
                        <TouchableOpacity style={[styles.addAccountBtn, { width: '100%' }]} onPress={() => {
                          setWithdrawModalVisible(false);
                          navigation.navigate('Profile');
                        }}>
                          <Text style={styles.addAccountBtnText}>Go to Profile to Add Bank/UPI</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </ScrollView>

                  {/* Amount Input */}
                  <TextInput
                    style={styles.amountInput}
                    placeholder="Amount to withdraw (₹)"
                    placeholderTextColor={theme.colors.textDim}
                    keyboardType="numeric"
                    value={withdrawAmount}
                    onChangeText={setWithdrawAmount}
                  />
                  <Text style={styles.processingNote}>Processing time: 1-2 business days</Text>

                  <Button title="Submit Request" onPress={() => {}} />
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
                  <View style={[styles.txIconBoxLarge, { backgroundColor: selectedTransaction.type === 'credit' ? '#e0f2fe' : '#fee2e2' }]}>
                    {selectedTransaction.type === 'credit' ? (
                      <ArrowDown size={32} color="#0284c7" />
                    ) : (
                      <ArrowUp size={32} color="#dc2626" />
                    )}
                  </View>
                  
                  <Text style={styles.txDetailTitle}>{selectedTransaction.title}</Text>
                  <Text style={[styles.txDetailAmount, { color: selectedTransaction.type === 'credit' ? '#059669' : '#dc2626' }]}>
                    {selectedTransaction.amount}
                  </Text>
                  
                  <View style={styles.txDetailInfoBox}>
                    <View style={styles.txDetailRow}>
                      <Text style={styles.txDetailLabel}>Status</Text>
                      <Text style={styles.txDetailValueSuccess}>Completed</Text>
                    </View>
                    <View style={styles.txDetailRow}>
                      <Text style={styles.txDetailLabel}>Date</Text>
                      <Text style={styles.txDetailValue}>{new Date(selectedTransaction.createdAt).toLocaleString()}</Text>
                    </View>
                    <View style={styles.txDetailRow}>
                      <Text style={styles.txDetailLabel}>Transaction ID</Text>
                      <Text style={styles.txDetailValue}>TXN-{Math.floor(Math.random() * 1000000000)}</Text>
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
  proceedBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  proceedBtnText: {
    color: '#001016',
    fontSize: 16,
    fontWeight: '800',
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
  submitBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#001016',
    fontSize: 16,
    fontWeight: '800',
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
