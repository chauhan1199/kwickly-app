import React, { useState } from 'react';
import { 
  ScrollView, 
  View, 
  StyleSheet, 
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
import { ArrowDown, ArrowUp, Landmark, Smartphone, Bell, ReceiptText, RefreshCw, Moon, Sun, Menu } from 'lucide-react-native';
import api from '../../services/api';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

const ShopWalletScreen = ({ navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const styles = createStyles(theme, isDarkMode);

  // Modals state
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);

  // Data state
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpMethod, setTopUpMethod] = useState('UPI');
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [subscriptionModalVisible, setSubscriptionModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [dynamicPlans, setDynamicPlans] = useState([]);

  React.useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    try {
      const [walletRes, settingsRes, balanceRes] = await Promise.all([
        api.get('/shops/my'),
        api.get('/settings/public').catch(() => null),
        api.get('/wallet/balance').catch(() => null)
      ]);

      if (settingsRes?.data?.status === 'success') {
        const plans = settingsRes.data.data.subscriptionPlans || [];
        const formatted = plans.map(p => ({
          id: p.id || p.label,
          title: p.label || p.name,
          desc: p.durationDays ? `${p.durationDays} days` : 'Custom duration',
          price: `₹${p.price || 0}`
        }));
        // Add default free trial as first option
        const allPlans = [
          { id: 'FREE_TRIAL', title: 'Worker Free Trial', desc: '6 months free', price: '₹0' },
          ...formatted
        ];
        setDynamicPlans(allPlans);
        if (!selectedPlan) setSelectedPlan(allPlans[0].id);
      }

      if (walletRes.data?.status === 'success') {
        const myShop = walletRes.data.data;
        setBalance(myShop.wallet?.balance || 0);
        
        const mappedAccs = (myShop.payoutMethods || []).map((m, i) => ({
          id: m._id || i.toString(),
          type: m.type === 'UPI' ? 'upi' : 'bank',
          name: m.type === 'UPI' ? 'UPI Account' : m.bankName || 'Bank Account',
          detail: m.type === 'UPI' ? m.upiId || m.detail : `****${(m.accountNumber || m.detail || '').slice(-4)}`,
          isPrimary: m.isPrimary
        }));
        setAccounts(mappedAccs);
        if (mappedAccs.length > 0) {
          const primary = mappedAccs.find(a => a.isPrimary) || mappedAccs[0];
          setSelectedAccountId(primary.id);
        }
      }
      
      if (balanceRes?.data?.status === 'success') {
        const tlist = balanceRes.data.data.transactions || [];
        const mappedTxns = tlist.map(t => ({
          id: t._id,
          txnId: t._id.slice(-8).toUpperCase(),
          title: t.description || 'Transaction',
          time: new Date(t.createdAt).toLocaleString(),
          amount: `₹${t.amount}`,
          type: ['TOPUP', 'ORDER_CREDIT', 'ADJUSTMENT'].includes(t.type) ? 'credit' : 'debit',
          status: t.status
        }));
        setTxns(mappedTxns);
      }
    } catch (e) {
      console.log('Error fetching wallet:', e);
    }
  };

  const handleSetPrimary = (id) => {
    setAccounts(accounts.map(acc => ({
      ...acc,
      isPrimary: acc.id === id
    })));
  };

  const handleDeleteAccount = (id) => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to remove this account?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => {
            setAccounts(accounts.filter(acc => acc.id !== id));
          }
        }
      ]
    );
  };

  const handleAddAccount = () => {
    Alert.alert("Add Account", "This would open the add bank/UPI flow.");
  };

  const handleSubmitWithdrawal = async () => {
    if (!withdrawAmount || isNaN(withdrawAmount) || Number(withdrawAmount) <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount.");
      return;
    }
    const selectedAcc = accounts.find(a => a.id === selectedAccountId);
    if (!selectedAcc) {
      Alert.alert("No Account", "Please select or add a bank/UPI account first.");
      return;
    }
    try {
      const res = await api.post('/wallet/withdraw', {
        amount: Number(withdrawAmount),
        payoutMethod: selectedAcc.detail
      });
      if (res.data?.status === 'success') {
        setWithdrawModalVisible(false);
        setWithdrawAmount('');
        Alert.alert("Success", "Withdrawal request submitted ✅\n\nIt will be processed in 1-2 business days.");
        fetchWallet();
      }
    } catch (e) {
      Alert.alert("Error", e.response?.data?.message || "Failed to withdraw.");
    }
  };

  const handleSubmitTopUp = async () => {
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
      const res = await api.post('/wallet/topup', {
        amount: Number(topUpAmount),
        paymentDetails: { method: selectedAcc ? selectedAcc.type : 'UPI', accountId: selectedAcc ? selectedAcc.id : undefined }
      });
      if (res.data?.status === 'success') {
        setTopUpModalVisible(false);
        setTopUpAmount('');
        Alert.alert("Success", "Wallet topped up successfully ✅");
        fetchWallet();
      }
    } catch (e) {
      Alert.alert("Error", e.response?.data?.message || "Failed to top up.");
    }
  };

  const handleConfirmSubscription = async () => {
    try {
      // Find selected plan to compute duration
      const planConfig = dynamicPlans.find(p => p.id === selectedPlan);
      const days = planConfig?.durationDays || (selectedPlan === 'FREE_TRIAL' ? 180 : 30);
      const d = new Date();
      d.setDate(d.getDate() + days);

      const res = await api.patch('/shops/my', {
        subscription: { plan: selectedPlan, validUntil: d }
      });
      if (res.data?.status === 'success') {
        setSubscriptionModalVisible(false);
        Alert.alert('Subscription Activated', 'Your subscription plan has been successfully updated!');
      }
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to update subscription');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      {/* App Bar */}
      <View style={styles.appBar}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <View>
            <Text style={styles.appBarTitle}>Shop Wallet</Text>
            <Text style={styles.appBarSubtitle}>Manage your balance</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity style={styles.appBarIconBtn} onPress={toggleTheme}>
            {isDarkMode ? <Sun size={20} color={theme.colors.text} /> : <Moon size={20} color={theme.colors.text} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.appBarIconBtn} onPress={() => navigation.navigate('ShopNotifications')}>
            <Bell size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Balance Card */}
        <LinearGradient 
          colors={isDarkMode ? ['#4C1D95', '#8B5CF6'] : ['#8B5CF6', '#C4B5FD']} 
          start={{x: 0, y: 0}} end={{x: 1, y: 1}}
          style={styles.balanceCard}
        >
          <Text style={[styles.balanceLabel, { color: 'rgba(255,255,255,0.8)' }]}>Available balance</Text>
          <Text style={[styles.balanceValue, { color: '#FFF' }]}>₹{balance}</Text>
          
          <View style={styles.balanceActions}>
            <TouchableOpacity style={styles.walletBtnLeft} onPress={() => setTopUpModalVisible(true)}>
              <Text style={styles.walletBtnLeftText}>Top Up</Text>
            </TouchableOpacity>
            <View style={styles.walletBtnDivider} />
            <TouchableOpacity style={styles.walletBtnRight} onPress={() => setWithdrawModalVisible(true)}>
              <Text style={styles.walletBtnRightText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Recent Transactions */}
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        
        <View style={styles.transactionsList}>
          {txns.length > 0 ? txns.map((t) => (
            <TouchableOpacity 
              key={t.id} 
              style={styles.transactionCard}
              onPress={() => {
                setSelectedTransaction(t);
                setTransactionModalVisible(true);
              }}
            >
              <View style={styles.txLeft}>
                <View style={[styles.txIconBox, { backgroundColor: t.type === 'credit' ? '#e0f2fe' : '#fee2e2' }]}>
                  {t.type === 'credit' ? (
                    <ArrowDown size={18} color="#0284c7" />
                  ) : (
                    <ArrowUp size={18} color="#dc2626" />
                  )}
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txTitle}>{t.title}</Text>
                  <Text style={styles.txTime}>
                    {t.time} • <Text style={{ color: t.status === 'PENDING' ? theme.colors.warning : (t.status === 'REJECTED' ? theme.colors.danger : theme.colors.success) }}>{t.status}</Text>
                  </Text>
                </View>
              </View>
              <Text style={[styles.txAmount, { color: t.type === 'credit' ? '#059669' : '#dc2626' }]}>
                {t.amount}
              </Text>
            </TouchableOpacity>
          )) : (
            <View style={{ padding: 30, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.textDim }}>No transactions yet.</Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

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

                  {/* Accounts List */}
                  <ScrollView style={styles.accountsList} showsVerticalScrollIndicator={false}>
                    {accounts.map(acc => (
                      <TouchableOpacity 
                        key={acc.id} 
                        style={[styles.accountCard, selectedAccountId === acc.id && styles.accountCardPrimary]}
                        onPress={() => setSelectedAccountId(acc.id)}
                      >
                        
                        <View style={styles.accountLeft}>
                          <View style={styles.accountIconBox}>
                            {acc.type === 'bank' ? <Landmark size={20} color="#0d9488" /> : <Smartphone size={20} color="#e11d48" />}
                          </View>
                          <View style={styles.accountInfo}>
                            <Text style={styles.accountName}>{acc.name}</Text>
                            <Text style={styles.accountDetail}>{acc.detail}</Text>
                          </View>
                        </View>
                        
                        <View style={styles.accountRight}>
                          {acc.isPrimary ? (
                            <View style={styles.primaryBadge}>
                              <Text style={styles.primaryBadgeText}>Primary</Text>
                            </View>
                          ) : (
                            <TouchableOpacity style={styles.setPrimaryBtn} onPress={() => handleSetPrimary(acc.id)}>
                              <Text style={styles.setPrimaryBtnText}>Set Primary</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteAccount(acc.id)}>
                            <Text style={styles.deleteBtnText}>Delete</Text>
                          </TouchableOpacity>
                        </View>

                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <TouchableOpacity style={styles.addAccountBtn} onPress={handleAddAccount}>
                    <Text style={styles.addAccountBtnText}>+ Add Bank or UPI</Text>
                  </TouchableOpacity>

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

                    <TouchableOpacity style={styles.withdrawSubmitBtn} onPress={handleSubmitWithdrawal}>
                      <Text style={styles.withdrawSubmitBtnText}>Submit Request</Text>
                    </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Top Up Funds Modal */}
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
                <View style={[styles.bottomSheet, { maxHeight: '60%' }]}>
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
                    <TouchableOpacity style={[styles.addAccountBtn, { paddingVertical: 12, marginBottom: 16 }]} onPress={() => { setTopUpModalVisible(false); navigation.navigate('Settings'); }}>
                      <Text style={styles.addAccountBtnText}>+ Add Payment Method</Text>
                    </TouchableOpacity>
                  )}

                  {/* Amount Input */}
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

                  <TouchableOpacity style={styles.withdrawSubmitBtn} onPress={handleSubmitTopUp}>
                    <Text style={styles.withdrawSubmitBtnText}>Proceed to Pay</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Subscription Modal */}
      <Modal
        visible={subscriptionModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSubscriptionModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setSubscriptionModalVisible(false)}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableWithoutFeedback>
              <View style={[styles.bottomSheet, { maxHeight: '90%', paddingBottom: 40 }]}>
                <View style={styles.sheetHeaderHandle} />
                <Text style={styles.sheetTitle}>Choose Subscription</Text>
                
                <View style={{ backgroundColor: '#10B98115', padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#10B98130' }}>
                  <Text style={{ color: '#059669', fontWeight: 'bold', textAlign: 'center', fontSize: 13 }}>
                    🎉 6 Months Free for Registered Workers!
                  </Text>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {(dynamicPlans.length > 0 ? dynamicPlans : [
                    { id: 'FREE_TRIAL', title: 'Worker Free Trial', desc: '6 months free', price: '₹0' }
                  ]).map(plan => (
                    <TouchableOpacity
                      key={plan.id}
                      style={[
                        styles.planCard,
                        selectedPlan === plan.id && styles.planCardSelected
                      ]}
                      onPress={() => setSelectedPlan(plan.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.planTitle, selectedPlan === plan.id && { color: theme.colors.primary }]}>{plan.title}</Text>
                        <Text style={styles.planDesc}>{plan.desc}</Text>
                      </View>
                      <Text style={[styles.planPrice, selectedPlan === plan.id && { color: theme.colors.primary }]}>{plan.price}</Text>
                      <View style={[styles.radioOuter, selectedPlan === plan.id && { borderColor: theme.colors.primary }]}>
                        {selectedPlan === plan.id && <View style={styles.radioInner} />}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity 
                  style={[styles.withdrawSubmitBtn, { marginTop: 16 }]} 
                  onPress={handleConfirmSubscription}
                >
                  <Text style={styles.withdrawSubmitBtnText}>Confirm Subscription</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Transaction Details Modal */}
      <Modal
        visible={transactionModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setTransactionModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setTransactionModalVisible(false)}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableWithoutFeedback>
              <View style={[styles.bottomSheet, { alignItems: 'center' }]}>
                {selectedTransaction && (
                  <>
                    <View style={styles.sheetHeaderHandle} />
                    
                    <View style={styles.receiptIconBox}>
                      <ReceiptText size={32} color="#a78bfa" />
                    </View>
                    
                    <Text style={styles.txDetailTitle}>{selectedTransaction.title}</Text>
                    <Text style={styles.txDetailTime}>{selectedTransaction.time}</Text>
                    
                    <Text style={[styles.txDetailAmount, { color: selectedTransaction.type === 'credit' ? '#059669' : '#dc2626' }]}>
                      {selectedTransaction.amount}
                    </Text>
                    
                    <View style={styles.txDetailInfoBox}>
                      <View style={styles.txDetailRow}>
                        <Text style={styles.txDetailLabel}>Transaction ID</Text>
                        <Text style={styles.txDetailValue}>{selectedTransaction.txnId}</Text>
                      </View>
                      <View style={styles.txDetailRow}>
                        <Text style={styles.txDetailLabel}>Status</Text>
                        <Text style={[styles.txDetailValue, { color: selectedTransaction.status === 'PENDING' ? theme.colors.warning : (selectedTransaction.status === 'REJECTED' ? theme.colors.danger : theme.colors.success), fontWeight: '700' }]}>
                          {selectedTransaction.status || 'Successful'}
                        </Text>
                      </View>
                      <View style={[styles.txDetailRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                        <Text style={styles.txDetailLabel}>Payment Method</Text>
                        <Text style={styles.txDetailValue}>Wallet</Text>
                      </View>
                    </View>

                    <TouchableOpacity 
                      style={styles.downloadBtn}
                      onPress={() => {
                        Alert.alert("Success", "Invoice downloaded successfully! 📄");
                        setTransactionModalVisible(false);
                      }}
                    >
                      <Text style={styles.downloadBtnText}>Download invoice</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableOpacity>
      </Modal>

      </SafeAreaView>
    </View>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
    backgroundColor: theme.colors.background,
  },
  appBarTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  appBarSubtitle: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginTop: 1,
  },
  appBarIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },
  balanceCard: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
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
    marginBottom: 24,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  walletBtnLeft: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  walletBtnLeftText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  walletBtnDivider: {
    width: 1,
    height: '60%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  walletBtnRight: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  walletBtnRightText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 16,
  },
  transactionsList: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  txIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txInfo: {
    marginLeft: 12,
    flex: 1,
  },
  txTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  txTime: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 4,
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
  accountsList: {
    maxHeight: 240,
    marginBottom: 16,
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
    gap: 12,
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
  addAccountBtn: {
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginBottom: 20,
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
  withdrawSubmitBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  withdrawSubmitBtnText: {
    color: '#001016',
    fontSize: 16,
    fontWeight: '800',
  },
  methodCard: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  methodCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '15',
  },
  methodCardText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textDim,
  },
  methodCardTextActive: {
    color: theme.colors.primary,
  },
  quickAmtBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickAmtText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  
  // Transaction Modal Styles
  receiptIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f3e8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  txDetailTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  txDetailTime: {
    fontSize: 14,
    color: theme.colors.textDim,
    marginTop: 4,
    marginBottom: 16,
  },
  txDetailAmount: {
    fontSize: 36,
    fontWeight: '900',
    marginBottom: 32,
  },
  txDetailInfoBox: {
    width: '100%',
    marginBottom: 32,
  },
  txDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  txDetailLabel: {
    fontSize: 14,
    color: theme.colors.textDim,
  },
  txDetailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  txDetailValueSuccess: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  downloadBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  downloadBtnText: {
    color: '#001016',
    fontSize: 16,
    fontWeight: '800',
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
    backgroundColor: theme.colors.surface,
  },
  planCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '05',
  },
  planTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  planDesc: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  planPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginRight: 16,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.textDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
});

export default ShopWalletScreen;
