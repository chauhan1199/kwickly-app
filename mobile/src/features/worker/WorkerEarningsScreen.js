import React, { useState, useCallback, useEffect } from 'react';
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
  Platform,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Linking
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Landmark, 
  Smartphone, 
  Wallet, 
  Calendar, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  X, 
  ChevronRight,
  CreditCard,
  Crown,
  Copy,
  Check,
  QrCode,
  ExternalLink
} from 'lucide-react-native';
import WorkerHeroHeader from '../../components/WorkerHeroHeader';
import WorkerBalanceCard from '../../components/WorkerBalanceCard';
import LinearGradient from 'react-native-linear-gradient';
import RazorpayCheckout from 'react-native-razorpay';

import { walletService } from '../../services/walletService';
import { workerService } from '../../services/workerService';
import settingsService from '../../services/settingsService';
import api from '../../services/api';
import { RAZORPAY_LOGO_URL } from '../../config/env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOP_UP_PRESETS = [100, 500, 1000, 2000];

const WorkerEarningsScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user, fetchUser } = useAuth();
  const styles = createStyles(theme, isDarkMode);

  const [wallet, setWallet] = useState({ balance: 0 });
  const [transactions, setTransactions] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [profile, setProfile] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [adminUpiConfig, setAdminUpiConfig] = useState({
    upiId: 'ganshyam.tech-1@oksbi',
    payeeName: 'Kwickly PVT LTD'
  });

  // Modals state
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);
  const [upiPaymentModalVisible, setUpiPaymentModalVisible] = useState(false);
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dynamicPlans, setDynamicPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [topUpAmount, setTopUpAmount] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [upiUtrNumber, setUpiUtrNumber] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [pendingPaymentContext, setPendingPaymentContext] = useState({ amount: 100, type: 'WALLET', planId: null });

  // Trial / Plan Calculation
  let daysLeft = 0;
  let isTrialActive = false;
  let isPlanActive = false;

  if (profile?.subscription?.expiryDate && new Date(profile.subscription.expiryDate) > new Date()) {
    isPlanActive = true;
    daysLeft = Math.ceil((new Date(profile.subscription.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
  } else if (profile?.subscription?.trialEndDate) {
    daysLeft = Math.ceil((new Date(profile.subscription.trialEndDate) - new Date()) / (1000 * 60 * 60 * 24));
    isTrialActive = daysLeft > 0;
    daysLeft = Math.max(0, daysLeft);
  } else {
    isTrialActive = false;
    daysLeft = 0;
  }
  const isActive = isTrialActive || isPlanActive;

  const fetchWalletAndProfile = useCallback(async () => {
    try {
      setRefreshing(true);
      const [walletRes, profileRes, settingsRes, chartRes, upiRes] = await Promise.allSettled([
        walletService.getWallet(),
        workerService.getProfile(),
        settingsService.getPublicSettings(),
        workerService.getEarningsChart('week'),
        api.get('/payments/admin-upi')
      ]);
      
      if (upiRes.status === 'fulfilled' && upiRes.value?.data?.status === 'success') {
        setAdminUpiConfig(upiRes.value.data.data);
      }

      if (settingsRes.status === 'fulfilled' && settingsRes.value?.data?.status === 'success') {
        const plansData = settingsRes.value.data.data.subscriptionPlans || [];
        const formatted = plansData
          .filter(p => !p.targetRole || p.targetRole === 'WORKER')
          .map(p => ({
            id: p.id || p.label,
            title: p.label || p.name,
            sub: p.durationDays ? `${p.durationDays} days validity` : 'Custom duration',
            price: `₹${p.price || 0}`,
            rawPrice: p.price || 0
          }));
        setDynamicPlans(formatted);
        if (formatted.length > 0 && !selectedPlan) {
          setSelectedPlan(formatted[0].id);
        }
      }

      if (walletRes.status === 'fulfilled' && walletRes.value?.data?.status === 'success') {
        const wData = walletRes.value.data.data;
        setWallet({ balance: wData.balance || 0 });
        const tlist = wData.transactions || [];
        const mappedTxns = tlist.map(t => ({
          id: t._id,
          txnId: t._id.slice(-8).toUpperCase(),
          title: t.description || 'Transaction',
          time: new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
          amount: t.amount,
          type: ['TOPUP', 'ORDER_CREDIT', 'ADJUSTMENT', 'JOB_CREDIT', 'REFERRAL_BONUS'].includes(t.type) ? 'credit' : 'debit',
          status: t.status
        }));
        setTransactions(mappedTxns);
      }

      if (chartRes.status === 'fulfilled' && chartRes.value?.data?.status === 'success') {
        const cData = chartRes.value.data.data;
        setChartData(cData.labels || []);
        setWeeklyEarnings(cData.total || 0);
      }

      if (profileRes.status === 'fulfilled' && profileRes.value?.data?.status === 'success') {
        const wProfile = profileRes.value.data.data;
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
        if (wProfile?.wallet?.upiDetails?.upiId || wProfile?.wallet?.upiId) {
          accs.push({
            id: 'upi',
            type: 'upi',
            name: 'UPI ID',
            detail: wProfile.wallet.upiDetails?.upiId || wProfile.wallet.upiId
          });
        }
        setAccounts(accs);
        if (accs.length > 0 && !selectedPayout) {
          setSelectedPayout(accs[0].id);
        }
      }
    } catch (e) {
      // Silently handled
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPlan, selectedPayout]);

  useEffect(() => {
    fetchWalletAndProfile();
  }, [fetchWalletAndProfile]);

  // Open Direct UPI app (GPay / PhonePe / Paytm / BHIM)
  const handleOpenUpiApp = async (amount, purposeTitle) => {
    const upiId = adminUpiConfig.upiId || 'ganshyam.tech-1@oksbi';
    const payee = adminUpiConfig.payeeName || 'Kwickly PVT LTD';
    const note = `Kwickly_${purposeTitle || 'Payment'}_${Date.now()}`;
    const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payee)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

    try {
      const supported = await Linking.canOpenURL(upiUrl);
      if (supported) {
        await Linking.openURL(upiUrl);
      } else {
        Alert.alert('UPI Apps', `Please copy UPI ID: ${upiId} and pay ₹${amount} in Google Pay, PhonePe or Paytm, then enter your 12-digit UTR below.`);
      }
    } catch (e) {
      Alert.alert('Payment Link', `Please copy UPI ID: ${upiId} and transfer ₹${amount} using your UPI app.`);
    }
  };

  const handleCopyUpiId = () => {
    const upiId = adminUpiConfig.upiId || 'ganshyam.tech-1@oksbi';
    Clipboard.setString(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  // Submit UPI UTR / Reference ID for instant verification & credit
  const handleVerifyUpiPayment = async () => {
    if (!upiUtrNumber || upiUtrNumber.trim().length < 6) {
      Alert.alert('Invalid UTR / Ref Number', 'Please enter a valid 12-digit UPI transaction reference / UTR number.');
      return;
    }

    try {
      setSubmittingAction(true);
      const { amount, type, planId } = pendingPaymentContext;

      const res = await walletService.topupWallet(
        Number(amount),
        { method: 'UPI', txnId: upiUtrNumber.trim() },
        planId || undefined,
        `upi_ord_${Date.now()}`,
        `upi_pay_${upiUtrNumber.trim()}`
      );

      if (res.data?.status === 'success' || res.data?.data) {
        setUpiPaymentModalVisible(false);
        setUpiUtrNumber('');
        Alert.alert(
          'Payment Success 🎉',
          type === 'PLAN'
            ? 'Your subscription plan has been activated successfully!'
            : `₹${amount} has been successfully added to your wallet balance.`
        );
        fetchWalletAndProfile();
        if (fetchUser) fetchUser('WORKER');
      } else {
        throw new Error(res.data?.message || 'Payment submission failed');
      }
    } catch (error) {
      Alert.alert('Verification Error', error.response?.data?.message || error.message || 'Could not verify payment.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Online Razorpay Payment flow
  const processRazorpayPayment = async (amount, context, extraData) => {
    try {
      setSubmittingAction(true);
      
      const orderRes = await walletService.createPaymentOrder({
        amount,
        purpose: context === 'PLAN' ? 'plan_subscription' : 'wallet_topup'
      });

      if (orderRes.data?.status !== 'success') {
        throw new Error(orderRes.data?.message || 'Failed to create payment order');
      }

      const { razorpayOrderId, keyId, amount: rpAmount, currency } = orderRes.data.data;

      const options = {
        description: context === 'PLAN' ? 'Subscription Plan Upgrade' : 'Wallet Balance Top-Up',
        image: RAZORPAY_LOGO_URL,
        currency: currency,
        key: keyId,
        amount: rpAmount,
        name: 'Kwickly',
        order_id: razorpayOrderId,
        theme: { color: '#6C47FF' }
      };

      const data = await RazorpayCheckout.open(options);

      if (context === 'PLAN') {
        const res = await walletService.topupWallet(
          amount, 
          { method: 'RAZORPAY', planId: extraData.planId, txnId: data.razorpay_payment_id }, 
          null, 
          data.razorpay_order_id, 
          data.razorpay_payment_id, 
          data.razorpay_signature
        );
        if (res.data?.status === 'success') {
          Alert.alert("Success 🎉", "Your subscription plan has been successfully activated!");
          fetchWalletAndProfile();
        }
      } else {
        const res = await walletService.topupWallet(
          amount, 
          { method: 'RAZORPAY', txnId: data.razorpay_payment_id }, 
          null, 
          data.razorpay_order_id, 
          data.razorpay_payment_id, 
          data.razorpay_signature
        );
        if (res.data?.status === 'success') {
          Alert.alert("Success ✅", `₹${amount} added to your wallet balance.`);
          setTopUpAmount('');
          fetchWalletAndProfile();
        }
      }
    } catch (e) {
      if (e.code === 0 || e.code === 2) {
        // User cancelled payment
      } else {
        // Switch to UPI payment modal fallback
        setPendingPaymentContext({
          amount: Number(amount),
          type: context,
          planId: extraData?.planId || null
        });
        setUpiPaymentModalVisible(true);
      }
    } finally {
      setSubmittingAction(false);
    }
  };

  const handlePlanProceed = () => {
    if (!selectedPlan) {
      Alert.alert("Select Plan", "Please choose a subscription plan to continue.");
      return;
    }
    const plan = dynamicPlans.find(p => p.id === selectedPlan);
    const amt = plan ? (plan.rawPrice || parseFloat(plan.price.replace('₹',''))) : 0;
    setPlanModalVisible(false);
    setPendingPaymentContext({ amount: amt, type: 'PLAN', planId: selectedPlan });
    setUpiPaymentModalVisible(true);
  };

  const handleTopUpProceed = () => {
    const amt = Number(topUpAmount);
    if (!topUpAmount || isNaN(amt) || amt < 10) {
      Alert.alert("Invalid Amount", "Please enter an amount of at least ₹10.");
      return;
    }
    setTopUpModalVisible(false);
    setPendingPaymentContext({ amount: amt, type: 'WALLET', planId: null });
    setUpiPaymentModalVisible(true);
  };

  const handleSubmitWithdrawal = async () => {
    const amt = Number(withdrawAmount);
    if (!withdrawAmount || isNaN(amt) || amt < 50) {
      Alert.alert("Invalid Amount", "Minimum withdrawal amount is ₹50.");
      return;
    }
    if (amt > wallet.balance) {
      Alert.alert("Insufficient Balance", `You only have ₹${wallet.balance.toFixed(2)} in your wallet.`);
      return;
    }
    if (!selectedPayout) {
      Alert.alert("Missing Destination", "Please select a payout account (Bank Account or UPI).");
      return;
    }
    
    try {
      setSubmittingAction(true);
      const payoutLabel = selectedPayout === 'bank' ? 'Bank Account' : 'UPI ID';
      const res = await walletService.requestWithdrawal(amt, payoutLabel);
      if (res.data?.status === 'success') {
        Alert.alert("Submitted ✅", "Withdrawal request submitted successfully. Payout will be processed within 24-48 hours.");
        setWithdrawAmount('');
        setWithdrawModalVisible(false);
        fetchWalletAndProfile();
      }
    } catch (e) {
      Alert.alert("Withdrawal Failed", e.response?.data?.message || "Failed to submit withdrawal request.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayDayIdx = (new Date().getDay() + 6) % 7; // 0 = Mon, 6 = Sun

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6C47FF" />
      
      {/* Earnings Header */}
      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }}
        style={styles.heroHeader}
      >
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.heroTitle}>Earnings & Wallet</Text>
            <Text style={styles.heroSubtitle}>Manage your balance, plans & payouts</Text>
          </View>
          <View style={styles.heroIconBox}>
            <Wallet size={24} color="#FFFFFF" />
          </View>
        </View>
      </LinearGradient>
      
      {/* Balance Card Component */}
      <WorkerBalanceCard 
        balance={wallet.balance} 
        onTopUp={() => setTopUpModalVisible(true)} 
        onWithdraw={() => setWithdrawModalVisible(true)} 
      />

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchWalletAndProfile} colors={['#6C47FF']} tintColor="#6C47FF" />
        }
      >
        {/* ═══════════════════════════════════════
            VIP SUBSCRIPTION PLAN BANNER
        ═══════════════════════════════════════ */}
        <View style={styles.planContainer}>
          <LinearGradient
            colors={isActive ? (isPlanActive ? ['#6C47FF', '#8B6FFF'] : ['#F59E0B', '#FBBF24']) : ['#EF4444', '#DC2626']}
            start={{ x: 0, y: 0 }} 
            end={{ x: 1, y: 1 }}
            style={styles.planCard}
          >
            <View style={styles.planCardTop}>
              <View style={styles.planTag}>
                <Crown size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
                <Text style={styles.planTagText}>
                  {isPlanActive ? 'PRO Plan Active' : isTrialActive ? 'Free Trial Active' : 'Plan Expired'}
                </Text>
              </View>
              <View style={styles.planDaysBadge}>
                <Text style={styles.planDaysBadgeText}>
                  {isActive ? `${daysLeft} Days Left` : 'Expired'}
                </Text>
              </View>
            </View>
            
            <Text style={styles.planDesc}>
              {isPlanActive 
                ? 'Your priority subscription is active. Top up to extend validity.'
                : isTrialActive 
                  ? 'Your free trial is currently active. Upgrade now to avoid service interruption.'
                  : 'Your subscription has ended. Upgrade to continue receiving customer job leads.'}
            </Text>
            
            <TouchableOpacity 
              style={styles.planActionBtn} 
              onPress={() => setPlanModalVisible(true)}
              activeOpacity={0.88}
            >
              <Text style={[styles.planActionBtnText, { color: isActive ? (isPlanActive ? '#6C47FF' : '#D97706') : '#DC2626' }]}>
                {isActive ? 'Extend Plan Validity →' : 'Activate Subscription Plan →'}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* ═══════════════════════════════════════
            WEEKLY EARNINGS BAR CHART
        ═══════════════════════════════════════ */}
        <View style={styles.chartSectionCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartHeaderLabel}>Weekly Earnings</Text>
              <Text style={styles.chartHeaderAmount}>₹{weeklyEarnings.toFixed(2)}</Text>
            </View>
            <View style={styles.weekPill}>
              <Calendar size={12} color="#6C47FF" style={{ marginRight: 4 }} />
              <Text style={styles.weekPillText}>This Week</Text>
            </View>
          </View>

          {/* Bar Chart Columns */}
          <View style={styles.chartBarsRow}>
            {daysOfWeek.map((dayName, idx) => {
              const dayData = chartData.find(d => d.label === dayName) || { value: 0 };
              const maxVal = Math.max(...chartData.map(d => d.value || 0), 500);
              const heightPct = Math.max(8, (dayData.value / maxVal) * 100);
              const isToday = idx === todayDayIdx;

              return (
                <View key={idx} style={styles.chartColumn}>
                  <View style={styles.barTrack}>
                    <View 
                      style={[
                        styles.barFill, 
                        { 
                          height: `${heightPct}%`, 
                          backgroundColor: isToday ? '#6C47FF' : (dayData.value > 0 ? '#A78BFA' : (isDarkMode ? '#334155' : '#E2E8F0'))
                        }
                      ]} 
                    />
                  </View>
                  <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                    {dayName}
                  </Text>
                </View>
              );
            })}
          </View>
          
          <Text style={styles.chartTipText}>
            {weeklyEarnings > 0 
              ? `You've earned ₹${weeklyEarnings.toFixed(2)} this week from completed jobs.` 
              : 'Complete customer jobs to view your daily revenue breakdown here.'}
          </Text>
        </View>

        {/* ═══════════════════════════════════════
            RECENT TRANSACTIONS LIST
        ═══════════════════════════════════════ */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <Text style={styles.txCountText}>{transactions.length} Total</Text>
        </View>
        
        <View style={styles.transactionsList}>
          {transactions.map((t) => {
            const isCredit = t.type === 'credit';
            const amountPrefix = isCredit ? '+' : '-';
            const color = isCredit ? '#10B981' : '#EF4444';
            const bg = isCredit ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';

            return (
              <TouchableOpacity 
                key={t.id} 
                style={styles.transactionCard}
                onPress={() => {
                  setSelectedTransaction(t);
                  setTransactionModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.txLeft}>
                  <View style={[styles.txIconBox, { backgroundColor: bg }]}>
                    {isCredit ? (
                      <ArrowDownLeft size={18} color="#10B981" />
                    ) : (
                      <ArrowUpRight size={18} color="#EF4444" />
                    )}
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txTitle} numberOfLines={1}>{t.title}</Text>
                    <Text style={styles.txTime}>{t.time}</Text>
                  </View>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.txAmount, { color }]}>
                    {amountPrefix}₹{Number(t.amount || 0).toFixed(2)}
                  </Text>
                  <View style={[styles.txStatusPill, { backgroundColor: t.status === 'PENDING' ? '#FFFBEB' : (t.status === 'REJECTED' ? '#FEF2F2' : '#ECFDF5') }]}>
                    <Text style={[styles.txStatusText, { color: t.status === 'PENDING' ? '#F59E0B' : (t.status === 'REJECTED' ? '#EF4444' : '#10B981') }]}>
                      {t.status || 'SUCCESS'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {transactions.length === 0 && !loading && (
            <View style={styles.emptyTxBox}>
              <CreditCard size={36} color="#6C47FF" />
              <Text style={styles.emptyTxTitle}>No Transactions Yet</Text>
              <Text style={styles.emptyTxSub}>Your wallet credits and payouts will appear here.</Text>
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ═══════════════════════════════════════
          MODAL 1: PLAN SELECTION MODAL
      ═══════════════════════════════════════ */}
      <Modal visible={planModalVisible} transparent animationType="slide" onRequestClose={() => setPlanModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Choose Subscription</Text>
                <Text style={styles.modalSub}>Select a plan to unlock priority job broadcasts</Text>
              </View>
              <TouchableOpacity onPress={() => setPlanModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {dynamicPlans.map((plan) => {
                const isSelected = selectedPlan === plan.id;
                return (
                  <TouchableOpacity 
                    key={plan.id}
                    style={[styles.planOptionCard, isSelected && styles.planOptionCardSelected]}
                    onPress={() => setSelectedPlan(plan.id)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.planOptionTitle, isSelected && { color: '#6C47FF' }]}>{plan.title}</Text>
                        {isSelected && (
                          <View style={styles.selectedPill}>
                            <Text style={styles.selectedPillText}>Selected</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.planOptionSub}>{plan.sub}</Text>
                    </View>
                    <Text style={[styles.planOptionPrice, isSelected && { color: '#6C47FF' }]}>{plan.price}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity 
              style={[styles.modalPrimaryBtn, submittingAction && { opacity: 0.7 }]} 
              onPress={handlePlanProceed}
              disabled={submittingAction}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#6C47FF', '#8B6FFF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.modalPrimaryGradient}
              >
                {submittingAction ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalPrimaryBtnText}>Proceed to Pay via UPI / Cards →</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════
          MODAL 2: WALLET TOP UP AMOUNT MODAL
      ═══════════════════════════════════════ */}
      <Modal visible={topUpModalVisible} transparent animationType="slide" onRequestClose={() => setTopUpModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Money to Wallet</Text>
                <Text style={styles.modalSub}>Instant balance top-up via UPI / Cards</Text>
              </View>
              <TouchableOpacity onPress={() => setTopUpModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            {/* Amount Input */}
            <View style={styles.amountInputBox}>
              <Text style={styles.rupeeSymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="500"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={topUpAmount}
                onChangeText={setTopUpAmount}
              />
            </View>

            {/* Quick Amount Chips */}
            <View style={styles.quickChipsRow}>
              {TOP_UP_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[styles.quickChip, topUpAmount === String(preset) && styles.quickChipActive]}
                  onPress={() => setTopUpAmount(String(preset))}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.quickChipText, topUpAmount === String(preset) && styles.quickChipTextActive]}>
                    +₹{preset}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={[styles.modalPrimaryBtn, (!topUpAmount || submittingAction) && { opacity: 0.7 }]} 
              onPress={handleTopUpProceed}
              disabled={submittingAction}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#6C47FF', '#8B6FFF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.modalPrimaryGradient}
              >
                {submittingAction ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalPrimaryBtnText}>Proceed to Pay via UPI →</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════
          MODAL 3: UPI PAYMENT CHECKOUT SHEET (GPay/PhonePe/Paytm/BHIM & UTR)
      ═══════════════════════════════════════ */}
      <Modal visible={upiPaymentModalVisible} transparent animationType="slide" onRequestClose={() => setUpiPaymentModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>UPI Payment Checkout</Text>
                <Text style={styles.modalSub}>Pay ₹{pendingPaymentContext.amount} to Admin UPI Account</Text>
              </View>
              <TouchableOpacity onPress={() => setUpiPaymentModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Admin UPI ID Box */}
              <View style={styles.adminUpiBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adminUpiLabel}>Admin UPI ID (Payee: {adminUpiConfig.payeeName || 'Kwickly'})</Text>
                  <Text style={styles.adminUpiVal}>{adminUpiConfig.upiId || 'ganshyam.tech-1@oksbi'}</Text>
                </View>
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopyUpiId} activeOpacity={0.8}>
                  {copiedUpi ? (
                    <Check size={16} color="#10B981" />
                  ) : (
                    <Copy size={16} color="#6C47FF" />
                  )}
                  <Text style={[styles.copyBtnText, copiedUpi && { color: '#10B981' }]}>
                    {copiedUpi ? 'Copied' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Option 1: Direct 1-Tap Open in UPI App */}
              <TouchableOpacity 
                style={styles.openUpiBtn} 
                onPress={() => handleOpenUpiApp(pendingPaymentContext.amount, pendingPaymentContext.type)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.openUpiGradient}
                >
                  <Smartphone size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.openUpiBtnText}>Pay ₹{pendingPaymentContext.amount} via UPI App</Text>
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.orDividerText}>— OR ENTER 12-DIGIT UTR / TXN ID AFTER TRANSFER —</Text>

              {/* UTR Input */}
              <View style={styles.utrInputBox}>
                <Text style={styles.inputSectionLabel}>12-Digit UPI Transaction / UTR Ref Number</Text>
                <TextInput
                  style={styles.utrInput}
                  placeholder="e.g. 423819204812"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={upiUtrNumber}
                  onChangeText={setUpiUtrNumber}
                />
              </View>

              {/* Verify & Credit Button */}
              <TouchableOpacity 
                style={[styles.modalPrimaryBtn, (!upiUtrNumber || submittingAction) && { opacity: 0.7 }]} 
                onPress={handleVerifyUpiPayment}
                disabled={submittingAction || !upiUtrNumber}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={['#6C47FF', '#8B6FFF']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.modalPrimaryGradient}
                >
                  {submittingAction ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>Verify & Credit ₹{pendingPaymentContext.amount} →</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════
          MODAL 4: WITHDRAWAL MODAL
      ═══════════════════════════════════════ */}
      <Modal visible={withdrawModalVisible} transparent animationType="slide" onRequestClose={() => setWithdrawModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Withdraw Earnings</Text>
                <Text style={styles.modalSub}>Transfer available balance to bank / UPI</Text>
              </View>
              <TouchableOpacity onPress={() => setWithdrawModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            <View style={styles.withdrawBalanceRow}>
              <Text style={styles.withdrawBalanceLabel}>Available Balance:</Text>
              <Text style={styles.withdrawBalanceVal}>₹{wallet.balance.toFixed(2)}</Text>
            </View>

            {/* Amount Input */}
            <View style={styles.amountInputBox}>
              <Text style={styles.rupeeSymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="Enter amount (min ₹50)"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
              />
            </View>

            {/* Payout Destination Selector */}
            <Text style={styles.sectionSubTitle}>Select Payout Account</Text>
            {accounts.length > 0 ? (
              accounts.map(acc => {
                const isSelected = selectedPayout === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.accountCard, isSelected && styles.accountCardSelected]}
                    onPress={() => setSelectedPayout(acc.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.accountIconBox}>
                      {acc.type === 'bank' ? (
                        <Landmark size={20} color={isSelected ? '#6C47FF' : '#64748B'} />
                      ) : (
                        <Smartphone size={20} color={isSelected ? '#6C47FF' : '#64748B'} />
                      )}
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.accountName, isSelected && { color: '#6C47FF' }]}>{acc.name}</Text>
                      <Text style={styles.accountDetail}>{acc.detail}</Text>
                    </View>
                    {isSelected && <CheckCircle2 size={18} color="#6C47FF" />}
                  </TouchableOpacity>
                );
              })
            ) : (
              <TouchableOpacity 
                style={styles.noAccountBox}
                onPress={() => {
                  setWithdrawModalVisible(false);
                  navigation.navigate('Profile');
                }}
              >
                <Text style={styles.noAccountText}>+ Add Bank Details or UPI ID in Profile</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.modalPrimaryBtn, (submittingAction || !withdrawAmount) && { opacity: 0.7 }]} 
              onPress={handleSubmitWithdrawal}
              disabled={submittingAction}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#6C47FF', '#8B6FFF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.modalPrimaryGradient}
              >
                {submittingAction ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalPrimaryBtnText}>Confirm Withdrawal</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════
          MODAL 5: TRANSACTION DETAILS MODAL
      ═══════════════════════════════════════ */}
      <Modal visible={transactionModalVisible} transparent animationType="fade" onRequestClose={() => setTransactionModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: 24 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transaction Details</Text>
              <TouchableOpacity onPress={() => setTransactionModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            {selectedTransaction && (
              <View style={styles.txDetailBox}>
                <Text style={styles.txDetailAmount}>
                  {selectedTransaction.type === 'credit' ? '+' : '-'}₹{selectedTransaction.amount}
                </Text>
                <Text style={styles.txDetailTitle}>{selectedTransaction.title}</Text>
                <View style={styles.txDetailRow}>
                  <Text style={styles.txDetailLabel}>Transaction ID</Text>
                  <Text style={styles.txDetailVal}>#{selectedTransaction.txnId}</Text>
                </View>
                <View style={styles.txDetailRow}>
                  <Text style={styles.txDetailLabel}>Date & Time</Text>
                  <Text style={styles.txDetailVal}>{selectedTransaction.time}</Text>
                </View>
                <View style={styles.txDetailRow}>
                  <Text style={styles.txDetailLabel}>Status</Text>
                  <Text style={[styles.txDetailVal, { color: '#10B981', fontWeight: '800' }]}>
                    {selectedTransaction.status || 'COMPLETED'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC',
  },
  heroHeader: {
    paddingTop: 54,
    paddingBottom: 38,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },

  // Plan Banner
  planContainer: {
    marginBottom: 18,
  },
  planCard: {
    borderRadius: 22,
    padding: 18,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  planCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  planTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planTagText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  planDaysBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  planDaysBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  planDesc: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 14,
  },
  planActionBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  planActionBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
  },

  // Chart Section
  chartSectionCard: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#EEF2F6',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  chartHeaderLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: isDarkMode ? '#94A3B8' : '#64748B',
  },
  chartHeaderAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    marginTop: 2,
  },
  weekPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  weekPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#6C47FF',
  },
  chartBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#334155' : '#F1F5F9',
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrack: {
    width: 24,
    height: 90,
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 6,
  },
  dayLabelToday: {
    color: '#6C47FF',
    fontWeight: '900',
  },
  chartTipText: {
    fontSize: 12,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 12,
    textAlign: 'center',
  },

  // Transactions Section
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  txCountText: {
    fontSize: 12,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    fontWeight: '600',
  },
  transactionsList: {
    gap: 10,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#EEF2F6',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  txIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  txTime: {
    fontSize: 11.5,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15.5,
    fontWeight: '900',
  },
  txStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  txStatusText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  emptyTxBox: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#EEF2F6',
  },
  emptyTxTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    marginTop: 10,
  },
  emptyTxSub: {
    fontSize: 12,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 2,
  },

  // Modals Styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 16,
  },
  modalHandle: {
    width: 44,
    height: 5,
    backgroundColor: isDarkMode ? '#334155' : '#E2E8F0',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  modalSub: {
    fontSize: 12.5,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  planOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#334155' : '#EEF2F6',
    marginBottom: 10,
  },
  planOptionCardSelected: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? '#1A1838' : '#FAF8FF',
  },
  planOptionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  planOptionSub: {
    fontSize: 12,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 2,
  },
  planOptionPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  selectedPill: {
    backgroundColor: 'rgba(108, 71, 255, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  selectedPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6C47FF',
  },
  modalPrimaryBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 16,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  modalPrimaryGradient: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  // Amount Inputs
  amountInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginBottom: 14,
  },
  rupeeSymbol: {
    fontSize: 26,
    fontWeight: '900',
    color: '#6C47FF',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  quickChipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  quickChipActive: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF',
  },
  quickChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: isDarkMode ? '#94A3B8' : '#64748B',
  },
  quickChipTextActive: {
    color: '#FFFFFF',
  },
  withdrawBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  withdrawBalanceLabel: {
    fontSize: 12.5,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    fontWeight: '600',
  },
  withdrawBalanceVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#6C47FF',
  },
  sectionSubTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    marginBottom: 8,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    marginBottom: 8,
  },
  accountCardSelected: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? '#1E1E38' : '#FAF8FF',
  },
  accountIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  accountDetail: {
    fontSize: 11.5,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 2,
  },
  noAccountBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6C47FF',
    borderStyle: 'dashed',
    alignItems: 'center',
    marginBottom: 10,
  },
  noAccountText: {
    color: '#6C47FF',
    fontSize: 13,
    fontWeight: '800',
  },

  // UPI Payment Sheet Specific Styles
  adminUpiBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDarkMode ? '#0F172A' : '#FAF8FF',
    borderWidth: 1.5,
    borderColor: '#6C47FF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  adminUpiLabel: {
    fontSize: 11,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  adminUpiVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#6C47FF',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6C47FF',
  },
  openUpiBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  openUpiGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  openUpiBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  orDividerText: {
    fontSize: 11,
    fontWeight: '800',
    color: isDarkMode ? '#64748B' : '#94A3B8',
    textAlign: 'center',
    marginVertical: 10,
    letterSpacing: 0.5,
  },
  utrInputBox: {
    marginBottom: 12,
  },
  inputSectionLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    marginBottom: 6,
  },
  utrInput: {
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14.5,
    fontWeight: '700',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },

  // Transaction Detail View
  txDetailBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  txDetailAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    marginBottom: 6,
  },
  txDetailTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginBottom: 20,
  },
  txDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#334155' : '#F1F5F9',
  },
  txDetailLabel: {
    fontSize: 13,
    color: isDarkMode ? '#94A3B8' : '#64748B',
  },
  txDetailVal: {
    fontSize: 13,
    fontWeight: '700',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
});

export default WorkerEarningsScreen;
