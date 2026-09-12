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
  Linking,
  AppState
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { nativeUpiService } from '../../services/nativeUpiService';
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
  ExternalLink,
  Zap,
  ChevronDown,
  ChevronUp,
  ArrowDown,
  ArrowUp,
  ShieldCheck,
  Share2,
  Printer,
  MapPin,
  Bell
} from 'lucide-react-native';
import WorkerHeroHeader from '../../components/WorkerHeroHeader';
import WorkerBalanceCard from '../../components/WorkerBalanceCard';
import LinearGradient from 'react-native-linear-gradient';

import { 
  GooglePayIcon, 
  PhonePeIcon, 
  PaytmIcon, 
  CredIcon, 
  BhimIcon 
} from '../../components/ui/UpiBrandIcons';
import { 
  generateAndSharePdfReceipt, 
  printReceiptPdf, 
  formatReceiptData 
} from '../../utils/receiptGenerator';

import { walletService } from '../../services/walletService';
import { utrValidationError } from '../../utils/upiValidation';
import { workerService } from '../../services/workerService';
import settingsService from '../../services/settingsService';
import api from '../../services/api';
import UpiPaymentWaitingModal from '../../components/UpiPaymentWaitingModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOP_UP_PRESETS = [100, 500, 1000, 2000];

const WorkerEarningsScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user, fetchUser } = useAuth();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const androidHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const safeTop = Math.max(insets.top, androidHeight) > 0 ? Math.max(insets.top, androidHeight) : 16;
  const styles = createStyles(theme, isDarkMode);

  const primaryAddress = user?.addresses?.find(a => a.isPrimary) || user?.addresses?.[0];
  const displayLocation = primaryAddress 
    ? `${primaryAddress.area ? primaryAddress.area + ', ' : ''}${primaryAddress.city || ''}`
    : (user?.city || 'Select Location');

  const [wallet, setWallet] = useState({ balance: 0 });
  const [transactions, setTransactions] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [profile, setProfile] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [adminUpiConfig, setAdminUpiConfig] = useState({
    upiId: '',
    payeeName: 'Kwickly Admin'
  });

  // Real-time Bank Verification Waiting Modal state
  const [waitingModalVisible, setWaitingModalVisible] = useState(false);
  const [waitingOrderId, setWaitingOrderId] = useState('');

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
  const [showManualUtr, setShowManualUtr] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [pendingPaymentContext, setPendingPaymentContext] = useState({ amount: 100, type: 'WALLET', planId: null });
  const [selectedUpiApp, setSelectedUpiApp] = useState('gpay');
  const [sharingReceipt, setSharingReceipt] = useState(false);


  // Auto-prompt UTR when user returns from UPI app
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && upiPaymentModalVisible) {
        setShowManualUtr(true);
      }
    });
    return () => sub.remove();
  }, [upiPaymentModalVisible]);

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
        const cleanPlanName = (title, days) => {
          const l = (title || '').toLowerCase().trim();
          if (['tests', 'test'].includes(l)) return 'Starter Monthly Pro';
          if (l === 'new') return 'Quarterly Growth Pro';
          if (l === 'rer') return 'Semi-Annual Value Plan';
          if (l === 'sds') return 'Annual VIP Elite';
          return title || (days ? `${days} Days Plan` : 'Standard Plan');
        };
        const formatted = plansData
          .filter(p => !p.targetRole || p.targetRole === 'WORKER')
          .map(p => ({
            id: p.id || p.label,
            title: cleanPlanName(p.label || p.name, p.durationDays),
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
          amountNum: t.amount,
          rawDate: t.createdAt,
          rawType: t.type,
          refId: t.razorpayPaymentId || t._id.slice(-8).toUpperCase(),
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

  const handlePayViaUpiApp = async (appKey = 'gpay') => {
    setSelectedUpiApp(appKey);
    const upiId = adminUpiConfig?.upiId;
    if (!upiId) {
      return Alert.alert('Payment Unavailable', 'Admin UPI is currently not configured. Please contact support.');
    }
    const cleanUpi = upiId.trim();
    const cleanPayee = (adminUpiConfig.payeeName || 'Kwickly Admin').trim().replace(/\s+/g, ' ');
    const amtStr = Number(pendingPaymentContext.amount).toFixed(2);
    const orderId = `worker_${pendingPaymentContext.type?.toLowerCase() || 'topup'}_${Date.now()}`;
    const shortTr = `KWIK${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(-4)}`.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
    const note = `Kwickly ${pendingPaymentContext.type || 'Payment'}`.replace(/[^a-zA-Z0-9 ]/g, '').trim().substring(0, 30);

    // Close app selection modal
    setUpiPaymentModalVisible(false);
    setWaitingOrderId(orderId);

    try {
      const result = await nativeUpiService.startUpiPayment({
        vpa: cleanUpi,
        name: cleanPayee,
        amount: amtStr,
        txnRef: shortTr,
        note,
        appKey,
      });

      // 1. If intent returned UTR
      const utr = (result?.approvalRefNo || result?.txnId || '').trim();
      if (utr && /^\d{12}$/.test(utr)) {
        const subRes = await handleManualUtrSubmission(utr, {
          isIntentVerified: true,
          intentStatus: result?.status || 'SUCCESS',
          responseCode: result?.responseCode || '00',
          rawResponse: result?.rawResponse || '',
          txnId: result?.txnId || ''
        });
        if (subRes?.verified === true || subRes?.status === 'COMPLETED') {
          Alert.alert('Payment Successful', `₹${pendingPaymentContext?.amount} has been added to your wallet.`);
        } else {
          Alert.alert('Verification In Progress', `UTR ${utr} submitted. Your wallet will update once confirmed by the bank.`);
        }
        fetchEarnings();
        return;
      }

      // Open waiting modal with confirmation step
      setWaitingModalVisible(true);
    } catch (e) {
      console.warn('[Worker UPI] App launch:', e.message);
      setWaitingModalVisible(false);
      setUpiPaymentModalVisible(false);
    }
  };

  const handleCopyUpiId = () => {
    const upiId = adminUpiConfig?.upiId;
    if (!upiId) {
      return Alert.alert('Admin UPI', 'Admin UPI ID is not configured.');
    }
    Clipboard.setString(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleManualUtrSubmission = async (utr, extraMeta = {}) => {
    const { amount, planId } = pendingPaymentContext;
    const res = await walletService.topupWallet(
      Number(amount),
      { method: 'UPI', txnId: utr },
      planId || undefined,
      utr,
      null,
      extraMeta
    );
    return res?.data?.data;
  };

  const handleShareReceiptPdf = async (txn) => {
    if (!txn) return;
    try {
      setSharingReceipt(true);
      const receiptData = formatReceiptData(txn, user, wallet.balance);
      await generateAndSharePdfReceipt(receiptData);
    } catch (e) {
      Alert.alert('Receipt Error', e.message || 'Could not share PDF receipt.');
    } finally {
      setSharingReceipt(false);
    }
  };

  const handlePrintReceiptPdf = async (txn) => {
    if (!txn) return;
    try {
      const receiptData = formatReceiptData(txn, user, wallet.balance);
      await printReceiptPdf(receiptData);
    } catch (e) {
      Alert.alert('Print Error', e.message || 'Could not print receipt.');
    }
  };

  // Direct UPI Payment flow
  const processRazorpayPayment = async (amount, context, extraData) => {
    setPendingPaymentContext({
      amount: Number(amount),
      type: context,
      planId: extraData?.planId || null
    });
    setSelectedUpiApp('gpay');
    setUpiPaymentModalVisible(true);
  };

  const handlePlanProceed = () => {
    if (!selectedPlan) {
      Alert.alert("Select Plan", "Please choose a subscription plan to continue.");
      return;
    }
    const plan = dynamicPlans.find(p => p.id === selectedPlan);
    const amt = plan ? (plan.rawPrice || parseFloat(plan.price.replace('₹',''))) : 0;
    setPlanModalVisible(false);
    setSelectedUpiApp('gpay');
    setPendingPaymentContext({ amount: amt, type: 'PLAN', planId: selectedPlan });
    setUpiPaymentModalVisible(true);
  };

  const handleTopUpProceed = () => {
    const amt = Number(topUpAmount);
    if (!topUpAmount || isNaN(amt) || amt < 100) {
      Alert.alert("Invalid Amount", "Please enter an amount of at least ₹100.");
      return;
    }
    setTopUpModalVisible(false);
    setSelectedUpiApp('gpay');
    setPendingPaymentContext({ amount: amt, type: 'WALLET', planId: null });
    setUpiPaymentModalVisible(true);
  };

  const handleSubmitWithdrawal = async () => {
    const safetyReserve = 100;
    const totalBalance = wallet.balance || 0;
    const withdrawableBalance = Math.max(0, totalBalance - safetyReserve);

    const amt = Number(withdrawAmount);
    if (!withdrawAmount || isNaN(amt) || amt < 10) {
      Alert.alert("Invalid Amount", "Minimum withdrawal amount is ₹10.");
      return;
    }
    if (amt > withdrawableBalance) {
      Alert.alert(
        "Insufficient Withdrawable Balance",
        `Your total balance is ₹${totalBalance.toFixed(2)}, but ₹${safetyReserve} is reserved as safety balance for job alerts. You can withdraw up to ₹${withdrawableBalance.toFixed(2)}.`
      );
      return;
    }
    if (!selectedPayout) {
      Alert.alert("Missing Destination", "Please select a payout account (Bank Account or UPI).");
      return;
    }
    
    try {
      setSubmittingAction(true);
      const selectedAcc = accounts.find(a => a.id === selectedPayout);
      const payoutLabel = selectedAcc ? `${selectedAcc.name} (${selectedAcc.detail})` : (selectedPayout === 'bank' ? 'Bank Account' : 'UPI ID');
      const res = await walletService.requestWithdrawal(amt, payoutLabel);
      if (res.data?.status === 'success') {
        Alert.alert(
          "Withdrawal Requested ✅",
          `Your withdrawal request for ₹${amt} has been submitted successfully.\n\nOur admin team will transfer the amount to your selected ${selectedPayout === 'bank' ? 'Bank Account' : 'UPI ID'} within 24-48 hours.`
        );
        setWithdrawAmount('');
        setWithdrawModalVisible(false);
        fetchWalletAndProfile();
        if (fetchUser) fetchUser('WORKER');
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
      <View style={{ zIndex: 10 }}>
        <LinearGradient
          colors={['#5830E0', '#7447FF', '#8F66FF']}
          start={{ x: 0, y: 0 }} 
          end={{ x: 1, y: 1 }}
          style={[styles.heroHeader, { paddingTop: safeTop + 8 }]}
        >
          <View style={styles.blob1} />
          <View style={styles.blob2} />

          {/* Top row: location + bell/notifications */}
          <View style={styles.heroTopRow}>
            <TouchableOpacity 
              style={styles.locationPill} 
              activeOpacity={0.85} 
              onPress={() => navigation.navigate('Profile')}
            >
              <MapPin size={12} color="#FFFFFF" />
              <Text style={styles.locationText} numberOfLines={1}>{displayLocation}</Text>
              <Text style={styles.locationCaret}>▾</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.bellBtn} 
              activeOpacity={0.85} 
              onPress={() => navigation.navigate('Notifications')}
            >
              <Bell size={18} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Title & Icon row */}
          <View style={styles.heroRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.heroTitle}>Earnings & Wallet</Text>
              <Text style={styles.heroSubtitle}>Manage your balance, plans & payouts</Text>
            </View>
            <View style={styles.heroIconBox}>
              <Wallet size={18} color="#FFFFFF" />
            </View>
          </View>
        </LinearGradient>
      </View>
      
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
            {topUpAmount !== '' && Number(topUpAmount) < 100 && (
              <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '700', marginTop: -8, marginBottom: 12, paddingHorizontal: 4 }}>
                ⚠️ Minimum top-up amount is ₹100
              </Text>
            )}

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
          MODAL 3: UPI PAYMENT CHECKOUT SHEET (6-App Grid)
      ═══════════════════════════════════════ */}
      <Modal visible={upiPaymentModalVisible} transparent animationType="slide" onRequestClose={() => setUpiPaymentModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Complete UPI Payment</Text>
                <Text style={styles.modalSub}>
                  {pendingPaymentContext.type === 'PLAN' ? 'Activate subscription plan' : 'Instant balance credit to Worker Wallet'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setUpiPaymentModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            {/* Amount Pill */}
            <View style={styles.amountPill}>
              <Text style={styles.amountPillLabel}>Amount to Pay</Text>
              <Text style={styles.amountPillValue}>₹{pendingPaymentContext.amount || 0}</Text>
            </View>

            {/* Quick UPI App Grid */}
            <Text style={styles.upiAppsHeading}>Choose UPI App</Text>
            <View style={styles.upiAppsGrid}>
              {[
                { key: 'gpay', name: 'Google Pay', icon: GooglePayIcon },
                { key: 'phonepe', name: 'PhonePe', icon: PhonePeIcon },
                { key: 'paytm', name: 'Paytm', icon: PaytmIcon },
                { key: 'bhim', name: 'BHIM', icon: BhimIcon },
                { key: 'cred', name: 'CRED', icon: CredIcon },
              ].map((app) => {
                const IconComponent = app.icon;
                const isSelected = selectedUpiApp === app.key;
                return (
                  <TouchableOpacity
                    key={app.key}
                    style={[styles.upiAppBtn, isSelected && styles.upiAppBtnSelected]}
                    onPress={() => handlePayViaUpiApp(app.key)}
                    activeOpacity={0.8}
                  >
                    <View style={{ marginBottom: 6 }}>
                      <IconComponent size={38} />
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

            <TouchableOpacity
              style={styles.confirmPayBtn}
              onPress={() => handlePayViaUpiApp(selectedUpiApp || 'gpay')}
              activeOpacity={0.85}
            >
              <Zap size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.confirmPayBtnText}>
                Pay ₹{pendingPaymentContext.amount || 0} via {selectedUpiApp === 'gpay' ? 'Google Pay' : selectedUpiApp === 'phonepe' ? 'PhonePe' : selectedUpiApp === 'paytm' ? 'Paytm' : selectedUpiApp === 'cred' ? 'CRED' : selectedUpiApp === 'bhim' ? 'BHIM' : 'UPI App'}
              </Text>
              <ChevronRight size={18} color="#fff" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
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

            {/* Balance Breakdown with Reserve Freeze */}
            <View style={styles.withdrawBalanceSummaryBox}>
              <View style={styles.withdrawBalanceRow}>
                <Text style={styles.withdrawBalanceLabel}>Total Wallet Balance</Text>
                <Text style={styles.withdrawBalanceValue}>₹{(wallet.balance || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.withdrawBalanceRow}>
                <Text style={styles.withdrawBalanceLabel}>Safety Balance Reserve</Text>
                <Text style={[styles.withdrawBalanceValue, { color: '#EF4444' }]}>- ₹100.00</Text>
              </View>
              <View style={styles.withdrawDivider} />
              <View style={styles.withdrawBalanceRow}>
                <Text style={[styles.withdrawBalanceLabel, { fontWeight: '800', color: theme.colors.text }]}>Maximum Withdrawable</Text>
                <Text style={[styles.withdrawBalanceValue, { color: '#10B981', fontSize: 16 }]}>
                  ₹{Math.max(0, (wallet.balance || 0) - 100).toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Amount Input */}
            <View style={styles.amountInputBox}>
              <Text style={styles.rupeeSymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="Amount (Min ₹10)"
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
          MODAL 5: TRANSACTION DETAILS & OFFICIAL RECEIPT
      ═══════════════════════════════════════ */}
      <Modal visible={transactionModalVisible} transparent animationType="fade" onRequestClose={() => setTransactionModalVisible(false)}>
        <View style={styles.centerOverlay}>
          <View style={styles.receiptCard}>
            {/* Header with verified badge */}
            <View style={styles.receiptTopHeader}>
              <View style={styles.receiptLogoBadge}>
                <ShieldCheck size={14} color="#10B981" />
                <Text style={styles.receiptLogoText}>KWICKLY VERIFIED RECEIPT</Text>
              </View>
              <TouchableOpacity onPress={() => setTransactionModalVisible(false)} style={styles.receiptCloseBtn}>
                <X size={16} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            {selectedTransaction && (
              <>
                {/* Amount Header */}
                <View style={styles.receiptAmtSection}>
                  <View style={[styles.txIconLarge, { backgroundColor: selectedTransaction.type === 'credit' ? '#10B98118' : '#EF444418' }]}>
                    {selectedTransaction.type === 'credit' ? (
                      <ArrowDown size={28} color="#10B981" />
                    ) : (
                      <ArrowUp size={28} color="#EF4444" />
                    )}
                  </View>
                  <Text style={styles.receiptDescText}>{selectedTransaction.title}</Text>
                  <Text style={[styles.receiptAmtValue, { color: selectedTransaction.type === 'credit' ? '#10B981' : theme.colors.text }]}>
                    {selectedTransaction.type === 'credit' ? '+' : '-'}₹{selectedTransaction.amount}
                  </Text>
                  <View style={[styles.receiptStatusBadge, { backgroundColor: selectedTransaction.status === 'COMPLETED' ? '#10B98120' : '#F59E0B20' }]}>
                    <Text style={[styles.receiptStatusText, { color: selectedTransaction.status === 'COMPLETED' ? '#10B981' : '#F59E0B' }]}>
                      {selectedTransaction.status === 'COMPLETED' ? 'SUCCESSFUL' : (selectedTransaction.status || 'COMPLETED')}
                    </Text>
                  </View>
                </View>

                {/* Details Breakdown */}
                <View style={styles.receiptDetailsBox}>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptKey}>Receipt ID</Text>
                    <Text style={[styles.receiptVal, styles.receiptValHighlight]}>#{selectedTransaction.txnId}</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptKey}>Date & Time</Text>
                    <Text style={styles.receiptVal}>{selectedTransaction.time}</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptKey}>Transaction Type</Text>
                    <Text style={styles.receiptVal}>{selectedTransaction.rawType || (selectedTransaction.type === 'credit' ? 'TOPUP / CREDIT' : 'WITHDRAWAL')}</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptKey}>Payment Mode</Text>
                    <Text style={styles.receiptVal}>Direct UPI / Bank</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptKey}>Reference / UTR</Text>
                    <Text style={styles.receiptVal}>{selectedTransaction.refId || selectedTransaction.txnId}</Text>
                  </View>
                  <View style={[styles.receiptRow, styles.receiptTotalRow]}>
                    <Text style={styles.receiptTotalKey}>Wallet Balance</Text>
                    <Text style={styles.receiptTotalVal}>₹{(wallet.balance || 0).toFixed(2)}</Text>
                  </View>
                </View>

                {/* PDF Receipt Sharing / Printing Actions */}
                <View style={styles.receiptActionRow}>
                  <TouchableOpacity 
                    style={styles.receiptShareBtn} 
                    onPress={() => handleShareReceiptPdf(selectedTransaction)}
                    disabled={sharingReceipt}
                    activeOpacity={0.85}
                  >
                    {sharingReceipt ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Share2 size={16} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.receiptShareBtnText}>Share PDF Receipt</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.receiptPrintBtn} 
                    onPress={() => handlePrintReceiptPdf(selectedTransaction)}
                    activeOpacity={0.85}
                  >
                    <Printer size={16} color="#6C47FF" style={{ marginRight: 8 }} />
                    <Text style={styles.receiptPrintBtnText}>Save / Print PDF</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Real-time Bank Verification Waiting Modal */}
      {waitingModalVisible && (
        <UpiPaymentWaitingModal
          visible={waitingModalVisible}
          onClose={() => setWaitingModalVisible(false)}
          onSuccess={() => {
            setWaitingModalVisible(false);
            fetchWalletAndProfile();
            if (fetchUser) fetchUser('WORKER');
          }}
          amount={pendingPaymentContext.amount}
          orderId={waitingOrderId}
          payeeName={adminUpiConfig.payeeName}
          upiVpa={adminUpiConfig.upiId}
          purpose={pendingPaymentContext.type === 'PLAN' ? 'subscription' : 'wallet_topup'}
          planTitle={pendingPaymentContext.type === 'PLAN' ? 'Worker Subscription Plan' : ''}
          onSubmitManualUtr={handleManualUtrSubmission}
        />
      )}
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC',
  },
  heroHeader: {
    paddingBottom: 22,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
    position: 'relative',
  },
  blob1: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  blob2: {
    position: 'absolute',
    bottom: -70,
    left: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    zIndex: 2,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    maxWidth: '75%',
    gap: 5,
  },
  locationText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11.5,
    flexShrink: 1,
  },
  locationCaret: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontWeight: '800',
  },
  bellBtn: {
    position: 'relative',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#7447FF',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
    marginBottom: 2,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 15,
  },
  heroIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  scrollContent: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  withdrawBalanceSummaryBox: {
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    marginBottom: 12,
  },
  withdrawBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  withdrawBalanceSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  withdrawBalanceDivider: {
    height: 1,
    backgroundColor: isDarkMode ? '#334155' : '#E2E8F0',
    marginVertical: 6,
  },
  withdrawBalanceLabel: {
    fontSize: 13,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    fontWeight: '700',
  },
  withdrawBalanceSubLabel: {
    fontSize: 12,
    color: isDarkMode ? '#64748B' : '#94A3B8',
    fontWeight: '500',
  },
  withdrawBalanceVal: {
    fontSize: 14.5,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  withdrawBalanceSubVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  quickWithdrawRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  quickWithdrawHint: {
    fontSize: 12,
    fontWeight: '700',
    color: isDarkMode ? '#94A3B8' : '#64748B',
  },
  quickWithdrawChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: isDarkMode ? '#1E293B' : '#EEF2F6',
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#CBD5E1',
  },
  quickWithdrawChipActive: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF',
  },
  quickWithdrawChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: isDarkMode ? '#CBD5E1' : '#475569',
  },
  quickWithdrawChipTextActive: {
    color: '#FFFFFF',
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
  },
  // UPI App Grid & Checkout styles
  amountPill: {
    backgroundColor: isDarkMode ? '#1E293B' : '#EEF2FF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E0E7FF',
  },
  amountPillLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: isDarkMode ? '#94A3B8' : '#64748B',
  },
  amountPillValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#6C47FF',
  },
  upiAppsHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: isDarkMode ? '#94A3B8' : '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  upiAppsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  upiAppBtn: {
    width: (SCREEN_WIDTH - 64 - 16) / 3,
    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    position: 'relative',
  },
  upiAppBtnSelected: {
    borderColor: '#6C47FF',
    backgroundColor: isDarkMode ? '#2D1B69' : '#F5F3FF',
  },
  upiAppLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: isDarkMode ? '#CBD5E1' : '#475569',
  },
  appCheckBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#6C47FF',
    borderRadius: 10,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utrSection: {
    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    marginBottom: 8,
  },
  utrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  utrHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: isDarkMode ? '#F1F5F9' : '#0F172A',
  },
  utrHeaderSub: {
    fontSize: 11.5,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    lineHeight: 16,
    marginBottom: 12,
  },
  confirmPayBtn: {
    backgroundColor: '#6C47FF',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmPayBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  reopenRow: {
    marginTop: 10,
    alignItems: 'center',
  },
  reopenBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  reopenText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6C47FF',
  },

  // Official Receipt Card Modal styles
  centerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  receiptCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  receiptTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  receiptLogoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  receiptLogoText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#10B981',
    letterSpacing: 0.8,
  },
  receiptCloseBtn: {
    padding: 4,
  },
  receiptAmtSection: {
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#334155' : '#F1F5F9',
    marginBottom: 14,
  },
  txIconLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  receiptDescText: {
    fontSize: 14,
    fontWeight: '700',
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginBottom: 4,
  },
  receiptAmtValue: {
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 8,
  },
  receiptStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  receiptStatusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  receiptDetailsBox: {
    gap: 10,
    marginBottom: 18,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptKey: {
    fontSize: 12.5,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    fontWeight: '600',
  },
  receiptVal: {
    fontSize: 12.5,
    color: isDarkMode ? '#F1F5F9' : '#0F172A',
    fontWeight: '700',
  },
  receiptValHighlight: {
    color: '#6C47FF',
    fontWeight: '800',
  },
  receiptTotalRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? '#334155' : '#F1F5F9',
  },
  receiptTotalKey: {
    fontSize: 13,
    fontWeight: '800',
    color: isDarkMode ? '#F1F5F9' : '#0F172A',
  },
  receiptTotalVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#10B981',
  },
  receiptActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  receiptShareBtn: {
    flex: 1,
    backgroundColor: '#6C47FF',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptShareBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  receiptPrintBtn: {
    flex: 1,
    backgroundColor: isDarkMode ? '#334155' : '#EEF2FF',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptPrintBtnText: {
    color: '#6C47FF',
    fontSize: 13,
    fontWeight: '800',
  },

  // UTR Input Styles
  utrInputBox: {
    marginBottom: 14,
  },
  utrInputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 0.3,
  },
  utrInput: {
    backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#6C47FF50',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 2,
  },
  utrHelpText: {
    fontSize: 11,
    color: theme.colors.textDim,
    marginTop: 6,
    lineHeight: 15,
  }
});

export default WorkerEarningsScreen;
