import React, { useState, useCallback, useEffect } from 'react';
import { 
  ScrollView, 
  View, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  StatusBar, 
  Modal, 
  TextInput, 
  Alert, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  Linking,
  AppState
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { nativeUpiService } from '../../services/nativeUpiService';
import { 
  ArrowDown, 
  ArrowUp, 
  Landmark, 
  Smartphone, 
  Bell, 
  ReceiptText, 
  RefreshCw, 
  Moon, 
  Sun, 
  CreditCard,
  CheckCircle2,
  AlertCircle,
  X,
  Copy,
  ChevronRight,
  ShieldCheck,
  Zap,
  Clock,
  Sparkles,
  Plus,
  Trash2,
  Check,
  ChevronDown, 
  ChevronUp,
  Share2,
  Printer,
  ExternalLink
} from 'lucide-react-native';
import { 
  GooglePayIcon, 
  PhonePeIcon, 
  PaytmIcon, 
  CredIcon, 
  BhimIcon, 
  AnyUpiIcon 
} from '../../components/ui/UpiBrandIcons';
import { 
  generateAndSharePdfReceipt, 
  printReceiptPdf, 
  formatReceiptData 
} from '../../utils/receiptGenerator';
import { shopService } from '../../services/shopService';
import { utrValidationError, isValidUtr } from '../../utils/upiValidation';
import { walletService } from '../../services/walletService';
import LinearGradient from 'react-native-linear-gradient';
import UpiPaymentWaitingModal from '../../components/UpiPaymentWaitingModal';

const TOP_UP_PRESETS = [100, 200, 500, 1000];
const MIN_SAFETY_FREEZE = 100; // ₹100 safety balance

const ShopWalletScreen = ({ navigation }) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const { user } = useAuth();
  const styles = createStyles(theme, isDarkMode);

  // Dynamic Admin UPI state
  const [adminUpiConfig, setAdminUpiConfig] = useState({ upiId: '', payeeName: 'Kwickly Admin', bankDetails: {} });

  // Real-time Bank Verification Waiting Modal state
  const [waitingModalVisible, setWaitingModalVisible] = useState(false);
  const [waitingContext, setWaitingContext] = useState({
    amount: 0,
    orderId: '',
    purpose: 'wallet_topup',
    planTitle: '',
    payeeName: 'Kwickly Admin',
    upiVpa: ''
  });

  // Modals state
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);
  const [upiPaymentModalVisible, setUpiPaymentModalVisible] = useState(false);
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
  const [subscriptionModalVisible, setSubscriptionModalVisible] = useState(false);
  const [addAccountModalVisible, setAddAccountModalVisible] = useState(false);

  // UPI App Selection state
  const [selectedUpiApp, setSelectedUpiApp] = useState('gpay');
  const [selectedSubUpiApp, setSelectedSubUpiApp] = useState('gpay');
  const [sharingReceipt, setSharingReceipt] = useState(false);

  // Data state
  const [loading, setLoading] = useState(true);

  const [submittingAction, setSubmittingAction] = useState(false);
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Top Up & Withdrawal forms
  const [topUpAmount, setTopUpAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [upiTxnId, setUpiTxnId] = useState('');
  const [showManualUtr, setShowManualUtr] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [dynamicPlans, setDynamicPlans] = useState([]);
  const [subPaymentStep, setSubPaymentStep] = useState(false);
  const [subUtr, setSubUtr] = useState('');
  const [showSubManualUtr, setShowSubManualUtr] = useState(false);

  // Auto-prompt UTR when user returns from UPI app
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        if (upiPaymentModalVisible) {
          setShowManualUtr(true);
        } else if (subscriptionModalVisible && subPaymentStep) {
          setShowSubManualUtr(true);
        }
      }
    });
    return () => sub.remove();
  }, [upiPaymentModalVisible, subscriptionModalVisible, subPaymentStep]);

  // Add Account form
  const [newAccountType, setNewAccountType] = useState('BANK'); // 'BANK' or 'UPI'
  const [newAccountBankName, setNewAccountBankName] = useState('');
  const [newAccountDetail, setNewAccountDetail] = useState('');
  const [newAccountIfsc, setNewAccountIfsc] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  const fetchWallet = useCallback(async () => {
    try {
      setLoading(true);
      const [shopRes, settingsRes, balanceRes, upiRes] = await Promise.all([
        shopService.getMyShop().catch(() => null),
        shopService.getPublicSettings().catch(() => null),
        shopService.getWalletBalance().catch(() => null),
        walletService.getAdminUpiConfig().catch(() => null)
      ]);

      if (upiRes?.data?.status === 'success' && upiRes.data.data?.upiId) {
        setAdminUpiConfig(upiRes.data.data);
      }

      if (settingsRes?.data?.status === 'success') {
        const plans = (settingsRes.data.data.subscriptionPlans || [])
          .filter(p => !p.targetRole || p.targetRole === 'SHOP');
        const formatted = plans.map(p => ({
          id: p.id || p.label,
          title: p.label || p.name,
          desc: p.durationDays ? `${p.durationDays} days validity` : 'Standard plan',
          price: `₹${p.price || 0}`,
          priceNum: p.price || 0,
          days: p.durationDays || 30
        }));
        setDynamicPlans(formatted);
        if (!formatted.find(p => p.id === selectedPlan)) {
          setSelectedPlan(formatted[0]?.id || '');
        }
      }

      if (shopRes?.data?.status === 'success') {
        const myShop = shopRes.data.data;
        setBalance(myShop.wallet?.balance || 0);

        const mappedAccs = (myShop.payoutMethods || []).map((m, i) => ({
          id: m._id || m.id || i.toString(),
          type: m.type === 'UPI' ? 'upi' : 'bank',
          name: m.label || (m.type === 'UPI' ? 'UPI Account' : m.bankName || 'Bank Account'),
          detail: m.detail,
          isPrimary: !!m.isPrimary
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
          title: t.description || (t.type === 'WITHDRAWAL' ? 'Withdrawal' : t.type === 'TOPUP' ? 'Wallet Top-Up' : 'Order Credit'),
          time: new Date(t.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          rawDate: t.createdAt,
          amount: `₹${Number(t.amount).toFixed(2)}`,
          amountNum: t.amount,
          type: ['TOPUP', 'ORDER_CREDIT', 'ADJUSTMENT', 'REFUND'].includes(t.type) ? 'credit' : 'debit',
          rawType: t.type,
          refId: t.razorpayPaymentId || t._id.slice(-8).toUpperCase(),
          status: t.status || 'COMPLETED'
        }));
        setTxns(mappedTxns);
      }
    } catch (e) {
      console.error('Wallet fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedPlan]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  // ═══════════════════════════════════════════
  // TOP UP & UPI PAYMENT
  // ═══════════════════════════════════════════
  const handleOpenTopUp = () => {
    setTopUpAmount('500');
    setPaymentInitiated(false);
    setSelectedUpiApp('gpay');
    setTopUpModalVisible(true);
  };

  const handleTopUpProceed = () => {
    const amt = parseFloat(topUpAmount);
    if (!amt || isNaN(amt) || amt < 10) {
      Alert.alert('Invalid Amount', 'Minimum top-up amount is ₹10.');
      return;
    }
    setPaymentInitiated(false);
    setTopUpModalVisible(false);
    setUpiPaymentModalVisible(true);
  };

  const handlePayViaUpiApp = async (appKey = 'gpay') => {
    setSelectedUpiApp(appKey);
    const upiId = adminUpiConfig?.upiId;
    if (!upiId) {
      return Alert.alert('Payment Unavailable', 'Admin UPI is not configured. Please contact support.');
    }
    const amt = parseFloat(topUpAmount) || 100;
    const payee = adminUpiConfig?.payeeName || 'Kwickly Admin';
    const orderId = `shop_topup_${Date.now()}`;
    const shortTr = `KWIK${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(-4)}`.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
    
    // Close modal & open real-time waiting modal
    setUpiPaymentModalVisible(false);
    setWaitingContext({
      amount: amt,
      orderId,
      purpose: 'wallet_topup',
      planTitle: '',
      payeeName: payee,
      upiVpa: upiId
    });
    setWaitingModalVisible(true);

    try {
      const result = await nativeUpiService.startUpiPayment({
        vpa: upiId,
        name: payee,
        amount: amt.toFixed(2),
        txnRef: shortTr,
        note: `Shop Topup ₹${amt}`,
        appKey,
      });

      if (result?.isSuccessful && (result.approvalRefNo || result.txnId)) {
        await handleManualUtrSubmission(result.approvalRefNo || result.txnId);
      }
    } catch (e) {
      console.warn('[Shop UPI] App launch:', e.message);
    }
  };

  const handleManualUtrSubmission = async (utr) => {
    if (waitingContext.purpose === 'subscription') {
      const res = await shopService.subscribePlan({
        planId: selectedPlan,
        paymentMethod: 'UPI',
        utrNumber: utr,
        targetRole: 'SHOP'
      });
      return res?.data?.data;
    } else {
      const res = await walletService.topupWallet(
        waitingContext.amount,
        { method: 'UPI', txnId: utr },
        null,
        utr
      );
      return res?.data?.data;
    }
  };


  const handleShareReceiptPdf = async (txn) => {
    if (!txn) return;
    setSharingReceipt(true);
    try {
      const receiptData = formatReceiptData(
        {
          _id: txn.id || txn.txnId,
          type: txn.rawType || (txn.type === 'credit' ? 'TOPUP' : 'WITHDRAWAL'),
          amount: txn.amountNum || parseFloat(txn.amount?.replace(/[^\d.]/g, '') || 0),
          createdAt: txn.rawDate || new Date().toISOString(),
          description: txn.title,
          status: txn.status || 'COMPLETED',
          razorpayPaymentId: txn.refId || txn.txnId || 'AUTO_CONFIRMED'
        },
        null,
        balance
      );
      await generateAndSharePdfReceipt(receiptData);
    } catch (e) {
      Alert.alert('PDF Sharing Error', e.message || 'Could not generate PDF receipt.');
    } finally {
      setSharingReceipt(false);
    }
  };

  const handlePrintReceiptPdf = async (txn) => {
    if (!txn) return;
    try {
      const receiptData = formatReceiptData(
        {
          _id: txn.id || txn.txnId,
          type: txn.rawType || (txn.type === 'credit' ? 'TOPUP' : 'WITHDRAWAL'),
          amount: txn.amountNum || parseFloat(txn.amount?.replace(/[^\d.]/g, '') || 0),
          createdAt: txn.rawDate || new Date().toISOString(),
          description: txn.title,
          status: txn.status || 'COMPLETED',
          razorpayPaymentId: txn.refId || txn.txnId || 'AUTO_CONFIRMED'
        },
        null,
        balance
      );
      await printReceiptPdf(receiptData);
    } catch (e) {
      Alert.alert('Printing Error', e.message || 'Could not open print manager.');
    }
  };

  // ═══════════════════════════════════════════
  // WITHDRAWAL FLOW
  // ═══════════════════════════════════════════
  const maxWithdrawable = Math.max(0, balance - MIN_SAFETY_FREEZE);

  const handleOpenWithdraw = () => {
    if (accounts.length === 0) {
      Alert.alert(
        'No Payout Destination',
        'Please add your Bank Account or UPI ID first before requesting withdrawal.',
        [
          { text: 'Add Now', onPress: handleAddAccount },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }
    setWithdrawAmount(maxWithdrawable > 0 ? String(Math.min(maxWithdrawable, 500)) : '');
    setWithdrawModalVisible(true);
  };

  const handleSubmitWithdrawal = async () => {
    const amt = parseFloat(withdrawAmount);
    if (!amt || isNaN(amt) || amt < 10) {
      Alert.alert('Invalid Amount', 'Minimum withdrawal amount is ₹10.');
      return;
    }

    if (amt > maxWithdrawable) {
      Alert.alert(
        'Safety Balance Protection',
        `Your wallet balance is ₹${balance.toFixed(2)}, but ₹${MIN_SAFETY_FREEZE.toFixed(2)} is reserved as safety balance.\n\nMaximum withdrawable balance is ₹${maxWithdrawable.toFixed(2)}.`
      );
      return;
    }

    const selectedAcc = accounts.find(a => a.id === selectedAccountId) || accounts[0];
    if (!selectedAcc) {
      Alert.alert('No Account', 'Please select a payout account.');
      return;
    }

    setSubmittingAction(true);
    try {
      const res = await shopService.withdraw(amt, selectedAcc.detail);
      if (res.data?.status === 'success') {
        setWithdrawModalVisible(false);
        setWithdrawAmount('');
        Alert.alert(
          'Withdrawal Initiated 🚀',
          `Your withdrawal request for ₹${amt} to ${selectedAcc.detail} has been submitted for admin approval.`
        );
        fetchWallet();
      }
    } catch (e) {
      Alert.alert('Withdrawal Failed', e.response?.data?.message || 'Failed to submit withdrawal.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // ═══════════════════════════════════════════
  // PAYOUT ACCOUNTS MANAGEMENT
  // ═══════════════════════════════════════════
  const handleAddAccount = () => {
    setNewAccountType('BANK');
    setNewAccountBankName('');
    setNewAccountDetail('');
    setNewAccountIfsc('');
    setAddAccountModalVisible(true);
  };

  const handleSubmitAddAccount = async () => {
    if (newAccountType === 'BANK') {
      if (!newAccountBankName.trim() || !newAccountDetail.trim() || !newAccountIfsc.trim()) {
        Alert.alert('Validation Error', 'Bank name, Account Number, and IFSC Code are required.');
        return;
      }
      if (!/^\d{9,18}$/.test(newAccountDetail.trim())) {
        Alert.alert('Invalid Account', 'Account number must be 9 to 18 digits.');
        return;
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(newAccountIfsc.trim())) {
        Alert.alert('Invalid IFSC', 'Please enter a valid 11-digit IFSC code (e.g. SBIN0001234).');
        return;
      }
    } else {
      const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
      if (!upiRegex.test(newAccountDetail.trim())) {
        Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID (e.g. yourname@okhdfcbank).');
        return;
      }
    }

    try {
      setSavingAccount(true);
      const detailString = newAccountType === 'BANK'
        ? `${newAccountDetail.trim()} (${newAccountIfsc.trim().toUpperCase()})`
        : newAccountDetail.trim();

      const payload = {
        type: newAccountType,
        bankName: newAccountType === 'BANK' ? newAccountBankName.trim() : 'UPI',
        detail: detailString,
      };

      const res = await shopService.addPayoutMethod(payload);
      if (res.data?.status === 'success') {
        setAddAccountModalVisible(false);
        Alert.alert('Success ✅', 'Payout method added successfully.');
        fetchWallet();
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to add payout method');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleSetPrimary = async (id) => {
    try {
      await shopService.setPrimaryPayoutMethod(id);
      fetchWallet();
      Alert.alert('Updated', 'Primary payout method updated.');
    } catch (e) {
      Alert.alert('Error', 'Failed to update primary account');
    }
  };

  const handleDeleteAccount = (id) => {
    Alert.alert(
      'Remove Account',
      'Are you sure you want to remove this payout destination?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await shopService.deletePayoutMethod(id);
              fetchWallet();
              Alert.alert('Removed', 'Payout account removed.');
            } catch (e) {
              Alert.alert('Error', 'Failed to remove account');
            }
          }
        }
      ]
    );
  };

  // ═══════════════════════════════════════════
  // SUBSCRIPTION MANAGEMENT
  // ═══════════════════════════════════════════
  const handleConfirmSubscription = () => {
    const planConfig = dynamicPlans.find(p => p.id === selectedPlan);
    if (!planConfig || !planConfig.priceNum) {
      Alert.alert('No Plan Selected', 'Please select a plan to continue.');
      return;
    }
    setSubUtr('');
    setSubPaymentInitiated(false);
    setSelectedSubUpiApp('gpay');
    setSubPaymentStep(true);
  };

  const handlePaySubscriptionUpi = async (appKey = 'gpay') => {
    setSelectedSubUpiApp(appKey);
    const upiId = adminUpiConfig?.upiId;
    if (!upiId) {
      return Alert.alert('Payment Unavailable', 'Admin UPI is not configured. Please contact support.');
    }
    const planConfig = dynamicPlans.find(p => p.id === selectedPlan);
    const amt = planConfig?.priceNum || 0;
    const payee = adminUpiConfig?.payeeName || 'Kwickly Admin';
    const orderId = `shop_sub_${Date.now()}`;
    const shortTr = `KWIK${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(-4)}`.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
    
    // Close subscription modal & open real-time waiting modal
    setSubscriptionModalVisible(false);
    setSubPaymentStep(false);
    setWaitingContext({
      amount: amt,
      orderId,
      purpose: 'subscription',
      planTitle: planConfig?.title || 'Shop Subscription',
      payeeName: payee,
      upiVpa: upiId
    });
    setWaitingModalVisible(true);

    try {
      const result = await nativeUpiService.startUpiPayment({
        vpa: upiId,
        name: payee,
        amount: amt.toFixed(2),
        txnRef: shortTr,
        note: `Shop Subscription ₹${amt}`,
        appKey,
      });

      if (result?.isSuccessful && (result.approvalRefNo || result.txnId)) {
        await handleManualUtrSubmission(result.approvalRefNo || result.txnId);
      }
    } catch (e) {
      console.warn('[Shop Sub UPI] App launch:', e.message);
    }
  };


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Shop Wallet</Text>
          <Text style={styles.headerSub}>Manage earnings & payouts</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={toggleTheme} activeOpacity={0.7}>
            {isDarkMode ? <Sun size={20} color={theme.colors.text} /> : <Moon size={20} color={theme.colors.text} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={fetchWallet} activeOpacity={0.7}>
            <RefreshCw size={20} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('ShopNotifications')} activeOpacity={0.7}>
            <Bell size={20} color={theme.colors.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* Wallet Hero Card */}
        <LinearGradient
          colors={['#6C47FF', '#8B6FFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>TOTAL WALLET BALANCE</Text>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>Instant UPI</Text>
            </View>
          </View>

          <Text style={styles.heroBalance}>₹{balance.toFixed(2)}</Text>

          {/* Reserve breakdown */}
          <View style={styles.heroBreakdown}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Safety Reserve</Text>
              <Text style={styles.breakdownVal}>₹{MIN_SAFETY_FREEZE.toFixed(2)}</Text>
            </View>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Max Withdrawable</Text>
              <Text style={[styles.breakdownVal, { color: '#A7F3D0' }]}>₹{maxWithdrawable.toFixed(2)}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.heroActionsRow}>
            <TouchableOpacity style={styles.heroBtnTopUp} onPress={handleOpenTopUp} activeOpacity={0.85}>
              <ArrowDown size={18} color="#6C47FF" />
              <Text style={styles.heroBtnTopUpText}>+ Add Money</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.heroBtnWithdraw, maxWithdrawable <= 0 && { opacity: 0.6 }]} 
              onPress={handleOpenWithdraw} 
              activeOpacity={0.85}
            >
              <ArrowUp size={18} color="#FFFFFF" />
              <Text style={styles.heroBtnWithdrawText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Subscription Plan Card */}
        <TouchableOpacity 
          style={styles.subBanner} 
          onPress={() => setSubscriptionModalVisible(true)}
          activeOpacity={0.85}
        >
          <View style={styles.subBannerLeft}>
            <View style={styles.subIconBox}>
              <Sparkles size={20} color="#F59E0B" />
            </View>
            <View>
              <Text style={styles.subBannerTitle}>Shop Subscription</Text>
              <Text style={styles.subBannerSub}>Free trial active · Tap to manage plans</Text>
            </View>
          </View>
          <ChevronRight size={20} color={theme.colors.textDim} />
        </TouchableOpacity>

        {/* Saved Payout Accounts */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Payout Destinations</Text>
          <TouchableOpacity onPress={handleAddAccount} activeOpacity={0.7}>
            <Text style={styles.sectionAddText}>+ Add Account</Text>
          </TouchableOpacity>
        </View>

        {accounts.length > 0 ? (
          accounts.map(acc => (
            <View key={acc.id} style={styles.accountItemCard}>
              <View style={styles.accountItemLeft}>
                <View style={[styles.accIconBox, { backgroundColor: acc.type === 'upi' ? '#EDE9FE' : '#CCFBF1' }]}>
                  {acc.type === 'upi' ? <Smartphone size={18} color="#6C47FF" /> : <Landmark size={18} color="#0D9488" />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.accountItemName}>{acc.name}</Text>
                    {acc.isPrimary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Primary</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.accountItemDetail}>{acc.detail}</Text>
                </View>
              </View>
              <View style={styles.accountItemActions}>
                {!acc.isPrimary && (
                  <TouchableOpacity style={styles.setPrimaryBtn} onPress={() => handleSetPrimary(acc.id)}>
                    <Text style={styles.setPrimaryText}>Set Default</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleDeleteAccount(acc.id)} style={{ padding: 4 }}>
                  <Trash2 size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <TouchableOpacity style={styles.noAccountsCard} onPress={handleAddAccount} activeOpacity={0.8}>
            <Landmark size={24} color="#6C47FF" />
            <Text style={styles.noAccountsText}>Add Bank Account or UPI ID to withdraw funds</Text>
          </TouchableOpacity>
        )}

        {/* Recent Transactions */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <Text style={styles.txCountText}>{txns.length} total</Text>
        </View>

        {loading ? (
          <View style={{ padding: 30, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#6C47FF" />
          </View>
        ) : txns.length > 0 ? (
          txns.map(t => (
            <TouchableOpacity 
              key={t.id} 
              style={styles.txCard} 
              onPress={() => {
                setSelectedTransaction(t);
                setTransactionModalVisible(true);
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.txIconBox, { backgroundColor: t.type === 'credit' ? '#ECFDF5' : '#FEF2F2' }]}>
                {t.type === 'credit' ? <ArrowDown size={18} color="#10B981" /> : <ArrowUp size={18} color="#EF4444" />}
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txTitle} numberOfLines={1}>{t.title}</Text>
                <Text style={styles.txTime}>{t.time}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.txAmount, { color: t.type === 'credit' ? '#10B981' : '#EF4444' }]}>
                  {t.type === 'credit' ? '+' : '-'}{t.amount}
                </Text>
                <View style={[
                  styles.txStatusPill, 
                  { backgroundColor: t.status === 'COMPLETED' ? '#ECFDF5' : t.status === 'PENDING' ? '#FFFBEB' : '#FEF2F2' }
                ]}>
                  <Text style={[
                    styles.txStatusText,
                    { color: t.status === 'COMPLETED' ? '#10B981' : t.status === 'PENDING' ? '#F59E0B' : '#EF4444' }
                  ]}>
                    {t.status || 'COMPLETED'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyTxCard}>
            <ReceiptText size={32} color={theme.colors.textDim} />
            <Text style={styles.emptyTxText}>No transactions recorded yet.</Text>
          </View>
        )}

      </ScrollView>

      {/* ═══════════════════════════════════════════
          MODAL 1: ADD MONEY (TOP UP AMOUNT)
      ═══════════════════════════════════════════ */}
      <Modal visible={topUpModalVisible} transparent animationType="slide" onRequestClose={() => setTopUpModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Money to Wallet</Text>
                <Text style={styles.modalSub}>Instant balance credit via UPI</Text>
              </View>
              <TouchableOpacity onPress={() => setTopUpModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            <View style={styles.amountInputRow}>
              <Text style={styles.rupeePrefix}>₹</Text>
              <TextInput
                style={styles.amountInputText}
                placeholder="500"
                placeholderTextColor={theme.colors.textDim}
                keyboardType="numeric"
                value={topUpAmount}
                onChangeText={setTopUpAmount}
              />
            </View>

            <View style={styles.presetChipsRow}>
              {TOP_UP_PRESETS.map(preset => (
                <TouchableOpacity
                  key={preset}
                  style={[styles.presetChip, topUpAmount === String(preset) && styles.presetChipActive]}
                  onPress={() => setTopUpAmount(String(preset))}
                >
                  <Text style={[styles.presetChipText, topUpAmount === String(preset) && styles.presetChipTextActive]}>
                    +₹{preset}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleTopUpProceed}>
              <Text style={styles.primaryBtnText}>Proceed to Pay via UPI →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════
          MODAL 2: UPI PAYMENT CHECKOUT
      ═══════════════════════════════════════════ */}
      <Modal visible={upiPaymentModalVisible} transparent animationType="slide" onRequestClose={() => setUpiPaymentModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Complete UPI Payment</Text>
                <Text style={styles.modalSub}>Instant balance credit to Shop Wallet</Text>
              </View>
              <TouchableOpacity onPress={() => setUpiPaymentModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            {/* Amount Pill */}
            <View style={styles.amountPill}>
              <Text style={styles.amountPillLabel}>Amount to Add</Text>
              <Text style={styles.amountPillValue}>₹{topUpAmount || 0}</Text>
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
                    onPress={() => handlePayViaUpiApp(app.key)}
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

            <TouchableOpacity
              style={styles.confirmPayBtn}
              onPress={() => handlePayViaUpiApp(selectedUpiApp || 'gpay')}
              activeOpacity={0.85}
            >
              <Zap size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.confirmPayBtnText}>
                Pay ₹{topUpAmount || 0} via {selectedUpiApp === 'gpay' ? 'Google Pay' : selectedUpiApp === 'phonepe' ? 'PhonePe' : selectedUpiApp === 'paytm' ? 'Paytm' : selectedUpiApp === 'cred' ? 'CRED' : selectedUpiApp === 'bhim' ? 'BHIM' : 'UPI App'}
              </Text>
              <ChevronRight size={18} color="#fff" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════
          MODAL 3: WITHDRAW FUNDS
      ═══════════════════════════════════════════ */}
      <Modal visible={withdrawModalVisible} transparent animationType="slide" onRequestClose={() => setWithdrawModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '92%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Withdraw Earnings</Text>
                <Text style={styles.modalSub}>Transfer funds to your account</Text>
              </View>
              <TouchableOpacity onPress={() => setWithdrawModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            {/* Balance Breakdown */}
            <View style={styles.withdrawBreakdownCard}>
              <View style={styles.wBreakdownRow}>
                <Text style={styles.wBreakdownLabel}>Total Wallet Balance</Text>
                <Text style={styles.wBreakdownVal}>₹{balance.toFixed(2)}</Text>
              </View>
              <View style={styles.wBreakdownRow}>
                <Text style={styles.wBreakdownLabel}>Safety Reserve (Freeze)</Text>
                <Text style={[styles.wBreakdownVal, { color: '#EF4444' }]}>- ₹{MIN_SAFETY_FREEZE.toFixed(2)}</Text>
              </View>
              <View style={styles.wBreakdownDivider} />
              <View style={styles.wBreakdownRow}>
                <Text style={[styles.wBreakdownLabel, { fontWeight: '800', color: theme.colors.text }]}>Max Withdrawable</Text>
                <Text style={[styles.wBreakdownVal, { fontWeight: '900', color: '#10B981', fontSize: 16 }]}>
                  ₹{maxWithdrawable.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Destination Selection */}
            <Text style={styles.fieldSectionLabel}>Select Destination Account</Text>
            <ScrollView style={{ maxHeight: 150, marginBottom: 14 }} showsVerticalScrollIndicator={false}>
              {accounts.map(acc => (
                <TouchableOpacity
                  key={acc.id}
                  style={[styles.accountOptionCard, selectedAccountId === acc.id && styles.accountOptionCardActive]}
                  onPress={() => setSelectedAccountId(acc.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountOptionName}>{acc.name}</Text>
                    <Text style={styles.accountOptionDetail}>{acc.detail}</Text>
                  </View>
                  {selectedAccountId === acc.id && (
                    <CheckCircle2 size={20} color="#6C47FF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Amount Input */}
            <View style={styles.amountInputRow}>
              <Text style={styles.rupeePrefix}>₹</Text>
              <TextInput
                style={styles.amountInputText}
                placeholder="0"
                placeholderTextColor={theme.colors.textDim}
                keyboardType="numeric"
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
              />
            </View>

            {/* Quick Chips */}
            <View style={styles.presetChipsRow}>
              {[100, 500, maxWithdrawable].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((amt, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.presetChip, withdrawAmount === String(amt) && styles.presetChipActive]}
                  onPress={() => setWithdrawAmount(String(amt))}
                >
                  <Text style={[styles.presetChipText, withdrawAmount === String(amt) && styles.presetChipTextActive]}>
                    {amt === maxWithdrawable ? `Max (₹${amt.toFixed(0)})` : `₹${amt}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={[styles.primaryBtn, submittingAction && { opacity: 0.7 }]} 
              onPress={handleSubmitWithdrawal}
              disabled={submittingAction}
            >
              {submittingAction ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Confirm Withdrawal →</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════
          MODAL 4: ADD PAYOUT ACCOUNT (BANK/UPI)
      ═══════════════════════════════════════════ */}
      <Modal visible={addAccountModalVisible} transparent animationType="slide" onRequestClose={() => setAddAccountModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Payout Destination</Text>
                <Text style={styles.modalSub}>Receive automated earnings payouts</Text>
              </View>
              <TouchableOpacity onPress={() => setAddAccountModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            {/* Type selector */}
            <View style={styles.typeToggleRow}>
              <TouchableOpacity
                style={[styles.typeToggleBtn, newAccountType === 'BANK' && styles.typeToggleBtnActive]}
                onPress={() => setNewAccountType('BANK')}
              >
                <Landmark size={16} color={newAccountType === 'BANK' ? '#fff' : theme.colors.text} />
                <Text style={[styles.typeToggleText, newAccountType === 'BANK' && { color: '#fff' }]}>Bank Account</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeToggleBtn, newAccountType === 'UPI' && styles.typeToggleBtnActive]}
                onPress={() => setNewAccountType('UPI')}
              >
                <Smartphone size={16} color={newAccountType === 'UPI' ? '#fff' : theme.colors.text} />
                <Text style={[styles.typeToggleText, newAccountType === 'UPI' && { color: '#fff' }]}>UPI ID</Text>
              </TouchableOpacity>
            </View>

            {newAccountType === 'BANK' ? (
              <>
                <Text style={styles.inputLabel}>Bank Name</Text>
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="e.g. State Bank of India, HDFC Bank"
                  placeholderTextColor={theme.colors.textDim}
                  value={newAccountBankName}
                  onChangeText={setNewAccountBankName}
                />
                <Text style={styles.inputLabel}>Account Number</Text>
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="e.g. 123456789012"
                  placeholderTextColor={theme.colors.textDim}
                  keyboardType="numeric"
                  value={newAccountDetail}
                  onChangeText={setNewAccountDetail}
                />
                <Text style={styles.inputLabel}>IFSC Code</Text>
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="e.g. SBIN0001234"
                  placeholderTextColor={theme.colors.textDim}
                  autoCapitalize="characters"
                  value={newAccountIfsc}
                  onChangeText={setNewAccountIfsc}
                />
              </>
            ) : (
              <>
                <Text style={styles.inputLabel}>UPI ID (VPA)</Text>
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="e.g. shopname@okhdfcbank"
                  placeholderTextColor={theme.colors.textDim}
                  autoCapitalize="none"
                  value={newAccountDetail}
                  onChangeText={setNewAccountDetail}
                />
              </>
            )}

            <TouchableOpacity 
              style={[styles.primaryBtn, savingAccount && { opacity: 0.7 }]} 
              onPress={handleSubmitAddAccount}
              disabled={savingAccount}
            >
              {savingAccount ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Save Account ✅</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════
          MODAL 5: SUBSCRIPTION PLANS
      ═══════════════════════════════════════════ */}
      <Modal visible={subscriptionModalVisible} transparent animationType="slide" onRequestClose={() => { setSubPaymentStep(false); setSubscriptionModalVisible(false); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '88%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Shop Subscriptions</Text>
                <Text style={styles.modalSub}>{subPaymentStep ? 'Choose UPI App to Activate Plan' : 'Select a plan for unlimited orders & delivery'}</Text>
              </View>
              <TouchableOpacity onPress={() => { setSubPaymentStep(false); setSubscriptionModalVisible(false); }} style={styles.closeBtn}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            {subPaymentStep ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Plan Amount Pill */}
                <View style={styles.amountPill}>
                  <Text style={styles.amountPillLabel}>Subscription Plan</Text>
                  <Text style={styles.amountPillValue}>₹{dynamicPlans.find(p => p.id === selectedPlan)?.priceNum || 0}</Text>
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
                    const isSelected = selectedSubUpiApp === app.key;
                    return (
                      <TouchableOpacity
                        key={app.key}
                        style={[styles.upiAppBtn, isSelected && styles.upiAppBtnSelected]}
                        onPress={() => handlePaySubscriptionUpi(app.key)}
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

                <TouchableOpacity
                  style={styles.confirmPayBtn}
                  onPress={() => handlePaySubscriptionUpi(selectedSubUpiApp || 'gpay')}
                  activeOpacity={0.85}
                >
                  <Zap size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.confirmPayBtnText}>
                    Pay ₹{dynamicPlans.find(p => p.id === selectedPlan)?.priceNum || 0} via {selectedSubUpiApp === 'gpay' ? 'Google Pay' : selectedSubUpiApp === 'phonepe' ? 'PhonePe' : selectedSubUpiApp === 'paytm' ? 'Paytm' : selectedSubUpiApp === 'cred' ? 'CRED' : selectedSubUpiApp === 'bhim' ? 'BHIM' : 'UPI App'}
                  </Text>
                  <ChevronRight size={18} color="#fff" style={{ marginLeft: 6 }} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setSubPaymentStep(false)} style={{ alignItems: 'center', marginTop: 14, paddingVertical: 6 }}>
                  <Text style={{ color: '#6C47FF', fontWeight: '700', fontSize: 13 }}>← Back to Plans</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <>
                <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                  {dynamicPlans.map(plan => (
                    <TouchableOpacity
                      key={plan.id}
                      style={[styles.subPlanCard, selectedPlan === plan.id && styles.subPlanCardActive]}
                      onPress={() => setSelectedPlan(plan.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.subPlanTitle, selectedPlan === plan.id && { color: '#6C47FF' }]}>{plan.title}</Text>
                        <Text style={styles.subPlanDesc}>{plan.desc}</Text>
                      </View>
                      <Text style={[styles.subPlanPrice, selectedPlan === plan.id && { color: '#6C47FF' }]}>{plan.price}</Text>
                      <View style={[styles.radioCircle, selectedPlan === plan.id && styles.radioCircleActive]}>
                        {selectedPlan === plan.id && <View style={styles.radioDot} />}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.primaryBtn, (submittingAction || !selectedPlan) && { opacity: 0.7 }]}
                  onPress={handleConfirmSubscription}
                  disabled={submittingAction || !selectedPlan}
                >
                  {submittingAction ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Proceed to Pay via UPI →</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════
          MODAL 6: TRANSACTION DETAILS & OFFICIAL RECEIPT
      ═══════════════════════════════════════════ */}
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
                    {selectedTransaction.type === 'credit' ? '+' : '-'}{selectedTransaction.amount}
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
                    <Text style={styles.receiptTotalVal}>₹{balance.toFixed(2)}</Text>
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
      <UpiPaymentWaitingModal
        visible={waitingModalVisible}
        onClose={() => setWaitingModalVisible(false)}
        onSuccess={() => {
          setWaitingModalVisible(false);
          fetchWallet();
        }}
        amount={waitingContext.amount}
        orderId={waitingContext.orderId}
        payeeName={waitingContext.payeeName}
        upiVpa={waitingContext.upiVpa}
        purpose={waitingContext.purpose}
        planTitle={waitingContext.planTitle}
        onSubmitManualUtr={handleManualUtrSubmission}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.text,
  },
  headerSub: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },

  // Hero Card
  heroCard: {
    margin: 16,
    borderRadius: 24,
    padding: 22,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 0.8,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  livePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  heroBalance: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 12,
  },
  heroBreakdown: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  breakdownItem: {
    flex: 1,
  },
  breakdownDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 12,
  },
  breakdownLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '600',
  },
  breakdownVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  heroActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heroBtnTopUp: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  heroBtnTopUpText: {
    color: '#6C47FF',
    fontWeight: '800',
    fontSize: 14,
  },
  heroBtnWithdraw: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  heroBtnWithdrawText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },

  // Subscription banner
  subBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  subBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  subBannerSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  sectionAddText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6C47FF',
  },
  txCountText: {
    fontSize: 12,
    color: theme.colors.textDim,
    fontWeight: '600',
  },

  // Payout accounts
  accountItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  accountItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  accIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountItemName: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  accountItemDetail: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  primaryBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },
  accountItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setPrimaryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: isDarkMode ? '#334155' : '#F1F5F9',
  },
  setPrimaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6C47FF',
  },
  noAccountsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    borderStyle: 'dashed',
    gap: 12,
  },
  noAccountsText: {
    fontSize: 13,
    color: theme.colors.textDim,
    fontWeight: '600',
    flex: 1,
  },

  // Transactions
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  txIconBox: {
    width: 38,
    height: 38,
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
    color: theme.colors.text,
  },
  txTime: {
    fontSize: 11,
    color: theme.colors.textDim,
    marginTop: 3,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '900',
  },
  txStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginTop: 4,
  },
  txStatusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  emptyTxCard: {
    alignItems: 'center',
    padding: 36,
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  emptyTxText: {
    fontSize: 13,
    color: theme.colors.textDim,
    marginTop: 8,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: isDarkMode ? '#334155' : '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.text,
  },
  modalSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
    borderRadius: 14,
  },

  // Amount Inputs
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    paddingHorizontal: 20,
    height: 64,
    marginBottom: 14,
  },
  rupeePrefix: {
    fontSize: 28,
    fontWeight: '900',
    color: '#6C47FF',
    marginRight: 6,
  },
  amountInputText: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.text,
    minWidth: 100,
    textAlign: 'center',
  },
  presetChipsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 20,
  },
  presetChip: {
    backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: 'rgba(108, 71, 255, 0.15)',
    borderColor: '#6C47FF',
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  presetChipTextActive: {
    color: '#6C47FF',
    fontWeight: '800',
  },
  primaryBtn: {
    backgroundColor: '#6C47FF',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  // UPI Info card
  upiInfoCard: {
    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    marginBottom: 14,
  },
  upiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  upiCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
  },
  upiIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    marginBottom: 8,
  },
  upiIdText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6C47FF',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6C47FF',
  },
  upiAmountHint: {
    fontSize: 12,
    color: theme.colors.textDim,
  },
  upiIntentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
    marginBottom: 16,
  },
  upiIntentBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  utrSection: {
    marginBottom: 18,
  },
  utrLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
  },
  utrInput: {
    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    letterSpacing: 1,
  },
  utrHint: {
    fontSize: 11,
    color: theme.colors.textDim,
    textAlign: 'center',
    marginTop: 4,
  },

  // Withdraw Breakdown
  withdrawBreakdownCard: {
    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    marginBottom: 14,
  },
  wBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  wBreakdownLabel: {
    fontSize: 13,
    color: theme.colors.textDim,
  },
  wBreakdownVal: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  wBreakdownDivider: {
    height: 1,
    backgroundColor: isDarkMode ? '#334155' : '#E2E8F0',
    marginVertical: 6,
  },
  fieldSectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
  },
  accountOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    marginBottom: 6,
  },
  accountOptionCardActive: {
    borderColor: '#6C47FF',
    backgroundColor: 'rgba(108, 71, 255, 0.08)',
  },
  accountOptionName: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
  },
  accountOptionDetail: {
    fontSize: 11,
    color: theme.colors.textDim,
    marginTop: 1,
  },

  // Add Account form
  typeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  typeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  typeToggleBtnActive: {
    backgroundColor: '#6C47FF',
    borderColor: '#6C47FF',
  },
  typeToggleText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
    marginTop: 8,
  },
  modalTextInput: {
    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 8,
  },

  // Sub plans
  subPlanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    marginBottom: 8,
  },
  subPlanCardActive: {
    borderColor: '#6C47FF',
    backgroundColor: 'rgba(108, 71, 255, 0.08)',
  },
  subPlanTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  subPlanDesc: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  subPlanPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: theme.colors.text,
    marginRight: 10,
  },
  // Subscription UPI payment step
  upiPayBox: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    padding: 16,
  },
  upiPayAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
  },
  upiPayNote: {
    fontSize: 12,
    color: theme.colors.textDim,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 12,
  },
  upiPayIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  upiPayIdText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    flex: 1,
  },
  upiPayCopyBtn: {
    padding: 6,
  },
  upiPayLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#6C47FF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 6,
  },
  upiPayInput: {
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#6C47FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 1,
    marginBottom: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: isDarkMode ? '#475569' : '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleActive: {
    borderColor: '#6C47FF',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6C47FF',
  },

  // Modern UPI & Receipt Card Styles
  amountPill: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: '#6C47FF12', 
    borderWidth: 1, 
    borderColor: '#6C47FF30', 
    borderRadius: 16, 
    paddingHorizontal: 18, 
    paddingVertical: 12, 
    marginBottom: 16 
  },
  amountPillLabel: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: theme.colors.text 
  },
  amountPillValue: { 
    fontSize: 22, 
    fontWeight: '900', 
    color: '#6C47FF' 
  },
  upiAppsHeading: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: theme.colors.textDim, 
    textTransform: 'uppercase', 
    letterSpacing: 0.8, 
    marginBottom: 10 
  },
  upiAppsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10, 
    marginBottom: 18 
  },
  upiAppBtn: { 
    width: '31%', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 12, 
    borderRadius: 16, 
    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', 
    borderWidth: 1.5, 
    borderColor: isDarkMode ? '#334155' : '#E2E8F0', 
    position: 'relative' 
  },
  upiAppBtnSelected: { 
    borderColor: '#6C47FF', 
    backgroundColor: '#6C47FF0D' 
  },
  upiAppLabel: { 
    fontSize: 11, 
    fontWeight: '700', 
    color: theme.colors.text, 
    textAlign: 'center' 
  },
  appCheckBadge: { 
    position: 'absolute', 
    top: 5, 
    right: 5, 
    width: 16, 
    height: 16, 
    borderRadius: 8, 
    backgroundColor: '#6C47FF', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  utrSection: { 
    marginBottom: 8 
  },
  utrHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginBottom: 4 
  },
  pulseDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: '#10B981' 
  },
  utrHeaderTitle: { 
    fontSize: 13.5, 
    fontWeight: '800', 
    color: theme.colors.text 
  },
  utrHeaderSub: { 
    fontSize: 12, 
    color: theme.colors.textDim, 
    lineHeight: 17, 
    marginBottom: 12 
  },
  confirmPayBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#6C47FF', 
    paddingVertical: 16, 
    paddingHorizontal: 16, 
    borderRadius: 16, 
    shadowColor: '#6C47FF', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 8, 
    elevation: 5 
  },
  confirmPayBtnText: { 
    fontSize: 14.5, 
    fontWeight: '800', 
    color: '#fff', 
    textAlign: 'center' 
  },
  reopenRow: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    marginTop: 12 
  },
  reopenBtnFull: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 6, 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    backgroundColor: '#6C47FF14', 
    borderRadius: 12 
  },
  reopenText: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#6C47FF' 
  },
  centerOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.65)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  
  /* ── Professional Receipt Card Styles ── */
  receiptCard: { 
    backgroundColor: theme.colors.surface, 
    borderRadius: 28, 
    padding: 22, 
    width: '100%', 
    maxWidth: 400, 
    borderWidth: 1, 
    borderColor: isDarkMode ? '#334155' : '#E2E8F0', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 16, 
    elevation: 8 
  },
  receiptTopHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: isDarkMode ? '#334155' : '#E2E8F0', 
    paddingBottom: 12 
  },
  receiptLogoBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    backgroundColor: '#10B98115', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 10 
  },
  receiptLogoText: { 
    fontSize: 11, 
    fontWeight: '800', 
    color: '#10B981', 
    letterSpacing: 0.5 
  },
  receiptCloseBtn: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  receiptAmtSection: { 
    alignItems: 'center', 
    marginBottom: 18 
  },
  txIconLarge: { 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  receiptDescText: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: theme.colors.textDim, 
    textAlign: 'center', 
    marginBottom: 4 
  },
  receiptAmtValue: { 
    fontSize: 32, 
    fontWeight: '900', 
    letterSpacing: -0.5, 
    marginBottom: 8 
  },
  receiptStatusBadge: { 
    paddingHorizontal: 12, 
    paddingVertical: 4, 
    borderRadius: 20 
  },
  receiptStatusText: { 
    fontSize: 11, 
    fontWeight: '800', 
    letterSpacing: 0.4 
  },
  receiptDetailsBox: { 
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', 
    borderRadius: 18, 
    padding: 16, 
    gap: 10, 
    borderWidth: 1, 
    borderColor: isDarkMode ? '#334155' : '#E2E8F0', 
    marginBottom: 18 
  },
  receiptRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  receiptKey: { 
    fontSize: 12.5, 
    color: theme.colors.textDim, 
    fontWeight: '600' 
  },
  receiptVal: { 
    fontSize: 12.5, 
    color: theme.colors.text, 
    fontWeight: '700', 
    textAlign: 'right', 
    flexShrink: 1, 
    marginLeft: 10 
  },
  receiptValHighlight: { 
    fontSize: 12.5, 
    color: '#6C47FF', 
    fontWeight: '800', 
    letterSpacing: 0.5 
  },
  receiptTotalRow: { 
    borderTopWidth: 1, 
    borderTopColor: isDarkMode ? '#334155' : '#E2E8F0', 
    paddingTop: 10, 
    marginTop: 4 
  },
  receiptTotalKey: { 
    fontSize: 13, 
    fontWeight: '800', 
    color: theme.colors.text 
  },
  receiptTotalVal: { 
    fontSize: 15, 
    fontWeight: '900', 
    color: '#10B981' 
  },
  receiptActionRow: { 
    width: '100%', 
    gap: 10 
  },
  receiptShareBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#6C47FF', 
    paddingVertical: 14, 
    borderRadius: 16, 
    shadowColor: '#6C47FF', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 8, 
    elevation: 4 
  },
  receiptShareBtnText: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: '#fff' 
  },
  receiptPrintBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#6C47FF12', 
    borderWidth: 1, 
    borderColor: '#6C47FF30', 
    paddingVertical: 13, 
    borderRadius: 16 
  },
  receiptPrintBtnText: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: '#6C47FF' 
  },

  // Tx details modal
  txDetailBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  txDetailAmount: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 6,
  },
  txDetailTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 16,
  },
  txDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#1E293B' : '#F1F5F9',
  },
  txDetailLabel: {
    fontSize: 13,
    color: theme.colors.textDim,
  },
  txDetailVal: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },

  // UTR & Flow Styles
  utrSection: {
    marginTop: 14,
    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
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
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  utrHeaderSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    lineHeight: 17,
    marginBottom: 14,
  },
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
  },
  reopenRow: {
    marginTop: 10,
    alignItems: 'center',
  },
  reopenBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  reopenText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6C47FF',
  }
});

export default ShopWalletScreen;
