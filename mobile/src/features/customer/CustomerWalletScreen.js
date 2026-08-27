import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, StatusBar, Modal, TextInput,
  TouchableWithoutFeedback, KeyboardAvoidingView, Platform, Alert, FlatList, ActivityIndicator, Linking
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTheme } from '../../context/ThemeContext';
import { Wallet, ArrowDown, ArrowUp, Plus, TrendingUp, Copy, CheckCircle2, Building2, ShieldCheck, X, Check, ExternalLink, ArrowRight, Shield, Zap } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppBar from '../../components/AppBar';
import CustomAlert from '../../components/ui/CustomAlert';
import { GooglePayIcon, PhonePeIcon, PaytmIcon, BhimUpiIcon } from '../../components/ui/UpiBrandIcons';

import { SearchBar } from '../../components/ui/SearchBar';
import { useFocusEffect } from '@react-navigation/native';
import { walletService } from '../../services/walletService';
import { useAuth } from '../../context/AuthContext';

const CustomerWalletScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user, fetchUser } = useAuth();
  const styles = createStyles(theme, isDarkMode);

  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [balance, setBalance] = useState(user?.wallet?.balance || 0);
  const [transactions, setTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [addMoneyModal, setAddMoneyModal] = useState(false);
  const [upiCheckoutModal, setUpiCheckoutModal] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [upiOrderData, setUpiOrderData] = useState(null);
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [selectedUpiApp, setSelectedUpiApp] = useState('gpay');
  const [upiTxnId, setUpiTxnId] = useState('');
  const [txnModal, setTxnModal] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [topupAmount, setTopupAmount] = useState('');

  // Custom Themed Alert
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'success',
    confirmText: 'OK',
    cancelText: 'Cancel',
    showCancel: false,
    onConfirm: () => {},
    onCancel: () => {},
  });

  const showAlert = ({
    title,
    message,
    type = 'success',
    confirmText = 'OK',
    cancelText = 'Cancel',
    showCancel = false,
    onConfirm,
    onCancel
  }) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      type,
      confirmText,
      cancelText,
      showCancel,
      onConfirm: () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
        if (onConfirm) onConfirm();
      },
      onCancel: () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
        if (onCancel) onCancel();
      }
    });
  };

  const QUICK_AMOUNTS = ['100', '250', '500', '1000'];

  const fetchWallet = async (isManual = false) => {
    try {
      if (isManual) setLoading(true);
      const res = await walletService.getWallet();
      if (res?.data?.status === 'success') {
        const wallet = res.data.data;
        setBalance(wallet?.balance ?? user?.wallet?.balance ?? 0);
        setTransactions(Array.isArray(wallet?.transactions) ? wallet.transactions : []);
      }
    } catch (e) {
      console.log('[Wallet] fetch error:', e?.message);
      if (user?.wallet?.balance !== undefined) {
        setBalance(user.wallet.balance);
      }
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchWallet(false);
      if (fetchUser) fetchUser();
    }, [])
  );

  const isCredit = (t) => ['JOB_CREDIT', 'ORDER_CREDIT', 'REFUND', 'REFERRAL_BONUS', 'TOPUP'].includes(t.type);

  const handleInitiateTopup = async () => {
    const amount = Number(topupAmount);
    if (!amount || isNaN(amount) || amount < 10) {
      return showAlert({
        title: 'Invalid Amount',
        message: 'Minimum topup is ₹10.',
        type: 'warning',
        confirmText: 'OK'
      });
    }
    
    setIsProcessing(true);
    try {
      const payRes = await walletService.createPaymentOrder({
        amount,
        purpose: 'wallet_topup',
        paymentMethod: 'UPI'
      });

      const payData = payRes?.data?.data || {};
      const orderPayload = {
        razorpayOrderId: payData.razorpayOrderId || `upi_${Date.now()}`,
        upiVpa: payData.upiVpa || 'ganshyam.tech-1@oksbi',
        payeeName: payData.payeeName || 'Kwickly PVT LTD',
        bankDetails: payData.bankDetails || {
          accountHolder: 'Kwickly PVT LTD',
          accountNumber: '1234567890',
          ifscCode: 'SBIN0001234',
          bankName: 'SBI'
        },
        upiIntentUri: payData.upiIntentUri || `upi://pay?pa=${payData.upiVpa || 'ganshyam.tech-1@oksbi'}&pn=${encodeURIComponent(payData.payeeName || 'Kwickly')}&am=${amount}&cu=INR&tn=Kwickly_wallet_topup_${Date.now()}&tr=${payData.razorpayOrderId || Date.now()}`,
        amount
      };

      setUpiOrderData(orderPayload);
      setPaymentInitiated(false);
      setSelectedUpiApp('gpay');
      setUpiTxnId('');
      setAddMoneyModal(false);
      setUpiCheckoutModal(true);
    } catch (error) {
      showAlert({
        title: 'Topup Failed',
        message: error.response?.data?.message || 'Failed to initialize payment. Please try again.',
        type: 'error',
        confirmText: 'OK'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenUpiApp = async (appScheme = 'gpay') => {
    if (!upiOrderData?.upiIntentUri) return;
    setSelectedUpiApp(appScheme);
    setPaymentInitiated(true);
    try {
      let targetUri = upiOrderData.upiIntentUri;
      if (appScheme === 'gpay') {
        targetUri = upiOrderData.upiIntentUri.replace('upi://', 'tez://upi/');
      } else if (appScheme === 'phonepe') {
        targetUri = upiOrderData.upiIntentUri.replace('upi://', 'phonepe://');
      } else if (appScheme === 'paytm') {
        targetUri = upiOrderData.upiIntentUri.replace('upi://', 'paytmmp://');
      }

      const supported = await Linking.canOpenURL(targetUri).catch(() => false);
      if (supported) {
        await Linking.openURL(targetUri);
      } else {
        await Linking.openURL(upiOrderData.upiIntentUri).catch(() => {
          showAlert({
            title: 'UPI App',
            message: `Please pay ₹${upiOrderData.amount} to UPI ID: ${upiOrderData.upiVpa} and enter the 12-digit UTR below.`,
            type: 'info',
            confirmText: 'Got It'
          });
        });
      }
    } catch (err) {
      Linking.openURL(upiOrderData.upiIntentUri).catch(() => {
        showAlert({
          title: 'UPI App',
          message: `Please pay ₹${upiOrderData.amount} to UPI ID: ${upiOrderData.upiVpa} and enter the 12-digit UTR below.`,
          type: 'info',
          confirmText: 'Got It'
        });
      });
    }
  };

  const handleCopyUpiId = () => {
    if (upiOrderData?.upiVpa) {
      Clipboard.setString(upiOrderData.upiVpa);
      setCopiedUpi(true);
      setPaymentInitiated(true);
      setTimeout(() => setCopiedUpi(false), 2500);
    }
  };

  const handleConfirmUpiTopup = async () => {
    if (!upiOrderData) return;
    const cleanUtr = upiTxnId.trim();
    if (!cleanUtr || cleanUtr.length < 4) {
      return showAlert({
        title: 'UTR Required',
        message: 'Please enter the 12-digit UPI Reference / UTR Number from your payment receipt.',
        type: 'warning',
        confirmText: 'OK'
      });
    }

    setIsVerifying(true);
    try {
      const verifyRes = await walletService.verifyPayment({
        razorpayOrderId: upiOrderData.razorpayOrderId,
        upiTransactionId: cleanUtr,
        utrNumber: cleanUtr,
        razorpayPaymentId: cleanUtr,
        razorpaySignature: 'upi_verified',
        purpose: 'wallet_topup',
        amount: upiOrderData.amount
      });

      if (verifyRes?.data?.status === 'success') {
        const verifyData = verifyRes.data.data;
        setUpiCheckoutModal(false);
        setTopupAmount('');
        setUpiTxnId('');
        setPaymentInitiated(false);
        if (fetchUser) await fetchUser();
        await fetchWallet();

        if (verifyData?.status === 'PENDING_VERIFICATION') {
          showAlert({
            title: 'Top-up Submitted ⏳',
            message: `Your UPI Reference (UTR: ${cleanUtr}) for ₹${upiOrderData.amount} has been submitted for verification. Balance will be credited once confirmed.`,
            type: 'info',
            confirmText: 'Done'
          });
        } else {
          showAlert({
            title: 'Top-up Successful! 🎉',
            message: `₹${upiOrderData.amount} has been verified and securely credited to your Kwickly Wallet (UTR: ${cleanUtr}).`,
            type: 'success',
            confirmText: 'Awesome!'
          });
        }
      } else {
        throw new Error(verifyRes?.data?.message || 'Verification failed');
      }
    } catch (error) {
      showAlert({
        title: 'Verification Failed',
        message: error.response?.data?.message || error.message || 'Failed to verify payment. Please check the UTR and try again.',
        type: 'error',
        confirmText: 'Try Again'
      });
    } finally {
      setIsVerifying(false);
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
      <StatusBar barStyle="light-content" backgroundColor="#6C47FF" />
      
      {/* Unified App Bar inside a purple gradient */}
      <LinearGradient
        colors={['#6C47FF', '#8B6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 40, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden', position: 'relative' }}
      >
        {/* Dynamic background shapes */}
        <View style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View style={{ position: 'absolute', bottom: -60, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />

        <AppBar title="My Wallet" transparent={true} showLogo={false} showBack={true} />
      </LinearGradient>

      {/* Sticky Search - overlapping header */}
      <View style={{ paddingHorizontal: 14, marginTop: -26, zIndex: 10, marginBottom: 10 }}>
        <SearchBar 
          value={searchQuery}
          onChangeText={setSearchQuery}
          theme={theme}
          placeholder="Search transactions..."
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]}>

        {/* Clean Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceCardInner}>
            <View style={{ backgroundColor: theme.colors.primary + '20', padding: 10, borderRadius: 16 }}>
              <Wallet size={24} color={theme.colors.primary} />
            </View>
            <Text style={styles.balanceLabel}>Available Balance</Text>
          </View>
          <Text style={styles.balanceAmount}>₹{balance.toLocaleString('en-IN')}</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddMoneyModal(true)}>
            <Plus size={16} color="#fff" />
            <Text style={styles.addBtnText}>Add Money</Text>
          </TouchableOpacity>
        </View>

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
          data={transactions.filter(t => !searchQuery || t.description?.toLowerCase().includes(searchQuery.toLowerCase()) || t.type?.toLowerCase().includes(searchQuery.toLowerCase()))}
          keyExtractor={i => i._id}
          renderItem={renderTxn}
          scrollEnabled={false}
          contentContainerStyle={{ gap: 10 }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: theme.colors.textDim, padding: 20 }}>No transactions found.</Text>}
        />

        <View style={{ height: 80 }} />
      </ScrollView>

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
                    onPress={handleInitiateTopup}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#fff" />
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

      {/* ── UPI Checkout Modal ── */}
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

            {/* Admin Payee Info Card */}
            <View style={styles.payeeCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.payeeNameLabel}>Admin Payee: {upiOrderData?.payeeName || 'Kwickly PVT LTD'}</Text>
                <Text style={styles.payeeUpiText}>{upiOrderData?.upiVpa || 'ganshyam.tech-1@oksbi'}</Text>
              </View>
              <TouchableOpacity style={styles.copyBtn} onPress={handleCopyUpiId}>
                {copiedUpi ? (
                  <CheckCircle2 size={16} color="#10B981" />
                ) : (
                  <Copy size={16} color="#6C47FF" />
                )}
                <Text style={[styles.copyBtnText, copiedUpi && { color: '#10B981' }]}>
                  {copiedUpi ? 'Copied' : 'Copy UPI'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick UPI App Grid */}
            <Text style={styles.upiAppsHeading}>Choose UPI App</Text>
            <View style={styles.upiAppsGrid}>
              {[
                { key: 'gpay', name: 'Google Pay', icon: GooglePayIcon },
                { key: 'phonepe', name: 'PhonePe', icon: PhonePeIcon },
                { key: 'paytm', name: 'Paytm', icon: PaytmIcon },
                { key: 'generic', name: 'Any UPI', icon: BhimUpiIcon },
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
                      <IconComponent size={34} />
                    </View>
                    <Text style={[styles.upiAppLabel, isSelected && { color: '#6C47FF', fontWeight: '800' }]}>
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

            {/* Step 2: Payment Initiated & UTR Input */}
            {paymentInitiated ? (
              <View style={styles.utrSection}>
                <View style={styles.utrHeader}>
                  <View style={styles.pulseDot} />
                  <Text style={styles.utrHeaderTitle}>
                    Payment Initiated via {selectedUpiApp === 'gpay' ? 'Google Pay' : selectedUpiApp === 'phonepe' ? 'PhonePe' : selectedUpiApp === 'paytm' ? 'Paytm' : 'UPI'}
                  </Text>
                </View>
                <Text style={styles.utrHeaderSub}>
                  Complete the ₹{upiOrderData?.amount} payment in your UPI app, then enter the 12-digit UPI Reference / UTR Number below to credit your wallet:
                </Text>

                <View style={styles.utrInputBox}>
                  <Text style={styles.utrInputLabel}>12-Digit UPI Reference / UTR Number *</Text>
                  <TextInput
                    style={styles.utrInput}
                    placeholder="e.g. 423456789012"
                    placeholderTextColor="#94A3B8"
                    value={upiTxnId}
                    onChangeText={setUpiTxnId}
                    autoCapitalize="characters"
                    returnKeyType="done"
                  />
                  <Text style={styles.utrHelpText}>
                    💡 You can find the 12-digit UTR in your payment details in Google Pay / PhonePe / Paytm.
                  </Text>
                </View>

                {/* Submit UTR Button */}
                <TouchableOpacity
                  style={[
                    styles.confirmPayBtn,
                    (!upiTxnId.trim() || upiTxnId.trim().length < 4 || isVerifying) && { opacity: 0.5 }
                  ]}
                  onPress={handleConfirmUpiTopup}
                  disabled={!upiTxnId.trim() || upiTxnId.trim().length < 4 || isVerifying}
                >
                  {isVerifying ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <ShieldCheck size={18} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.confirmPayBtnText}>
                        {upiTxnId.trim().length >= 4
                          ? `✓ I Have Paid ₹${upiOrderData?.amount || 0} • Add to Wallet`
                          : 'Enter UTR Number to Confirm'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.reopenRow}>
                  <TouchableOpacity onPress={() => handleOpenUpiApp(selectedUpiApp)} style={styles.reopenBtn}>
                    <ExternalLink size={13} color="#6C47FF" />
                    <Text style={styles.reopenText}>Re-open UPI App</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCopyUpiId} style={styles.reopenBtn}>
                    <Copy size={13} color="#6C47FF" />
                    <Text style={styles.reopenText}>Copy Admin UPI ID</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {/* Bank Transfer Details Box */}
                {upiOrderData?.bankDetails && (
                  <View style={styles.bankDetailsBox}>
                    <View style={styles.bankHeader}>
                      <Building2 size={16} color="#6C47FF" />
                      <Text style={styles.bankHeaderText}>Direct Bank Transfer (IMPS / NEFT)</Text>
                    </View>
                    <View style={styles.bankGrid}>
                      <Text style={styles.bankField}>A/C: <Text style={styles.bankVal}>{upiOrderData.bankDetails.accountNumber}</Text></Text>
                      <Text style={styles.bankField}>IFSC: <Text style={styles.bankVal}>{upiOrderData.bankDetails.ifscCode}</Text></Text>
                      <Text style={styles.bankField}>Bank: <Text style={styles.bankVal}>{upiOrderData.bankDetails.bankName}</Text></Text>
                    </View>
                  </View>
                )}

                {/* Pay via App Button */}
                <TouchableOpacity
                  style={styles.confirmPayBtn}
                  onPress={() => handleOpenUpiApp(selectedUpiApp || 'gpay')}
                  activeOpacity={0.85}
                >
                  <Zap size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.confirmPayBtnText}>
                    Pay ₹{upiOrderData?.amount || 0} via {selectedUpiApp === 'gpay' ? 'Google Pay' : selectedUpiApp === 'phonepe' ? 'PhonePe' : selectedUpiApp === 'paytm' ? 'Paytm' : 'UPI App'}
                  </Text>
                  <ArrowRight size={18} color="#fff" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </>
            )}
          </View>
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
                    {[['Type', selectedTxn.type], ['Date', new Date(selectedTxn.createdAt || selectedTxn.txnDate).toLocaleString()], ['ID', (selectedTxn._id || '').slice(-8)]].map(([k, v]) => (
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

      {/* Modern Themed Alert Modal */}
      <CustomAlert {...alertConfig} />
    </SafeAreaView>
  );
};


const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container:      { flex: 1, backgroundColor: theme.colors.background },
  scroll:         { padding: 20 },
  balanceCard:    { backgroundColor: theme.colors.surface, borderRadius: 24, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: theme.colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  balanceCardInner:{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  balanceLabel:   { fontSize: 16, color: theme.colors.textDim, fontWeight: '700' },
  balanceAmount:  { fontSize: 40, fontWeight: '900', color: theme.colors.text, marginBottom: 20, letterSpacing: -1 },
  addBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.primary, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 16 },
  addBtnText:     { fontSize: 15, fontWeight: '800', color: '#fff' },
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
  payBtnText:     { fontSize: 16, fontWeight: '800', color: '#fff' },
  upiSheet:       { backgroundColor: theme.colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 22, paddingBottom: Platform.OS === 'ios' ? 40 : 26 },
  upiHeaderRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  upiSubtitle:    { fontSize: 12.5, color: theme.colors.textDim, marginTop: 2, fontWeight: '500' },
  closeBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' },
  amountPill:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#6C47FF12', borderWidth: 1, borderColor: '#6C47FF30', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 12, marginBottom: 16 },
  amountPillLabel:{ fontSize: 14, fontWeight: '700', color: theme.colors.text },
  amountPillValue:{ fontSize: 22, fontWeight: '900', color: '#6C47FF' },
  payeeCard:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.background, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 18 },
  payeeNameLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5 },
  payeeUpiText:   { fontSize: 14.5, fontWeight: '800', color: theme.colors.text, marginTop: 2 },
  copyBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#6C47FF18', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  copyBtnText:    { fontSize: 12, fontWeight: '800', color: '#6C47FF' },
  upiAppsHeading: { fontSize: 13, fontWeight: '700', color: theme.colors.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  upiAppsGrid:    { flexDirection: 'row', gap: 10, marginBottom: 18 },
  upiAppBtn:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 16, backgroundColor: theme.colors.background, borderWidth: 1.5, borderColor: theme.colors.border, position: 'relative' },
  upiAppBtnSelected: { borderColor: '#6C47FF', backgroundColor: '#6C47FF0D' },
  upiAppEmoji:    { fontSize: 20, marginBottom: 4 },
  upiAppLabel:    { fontSize: 11, fontWeight: '700', color: theme.colors.text },
  appCheckBadge:  { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: '#6C47FF', justifyContent: 'center', alignItems: 'center' },
  
  utrSection:     { marginBottom: 8 },
  utrHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  pulseDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  utrHeaderTitle: { fontSize: 13.5, fontWeight: '800', color: theme.colors.text },
  utrHeaderSub:   { fontSize: 12, color: theme.colors.textDim, lineHeight: 17, marginBottom: 12 },
  utrInputBox:    { backgroundColor: theme.colors.background, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: '#6C47FF', marginBottom: 16 },
  utrInputLabel:  { fontSize: 11.5, fontWeight: '800', color: '#6C47FF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  utrInput:       { fontSize: 16, fontWeight: '800', color: theme.colors.text, paddingVertical: 4, letterSpacing: 1 },
  utrHelpText:    { fontSize: 11, color: theme.colors.textDim, marginTop: 6, lineHeight: 15 },
  reopenRow:      { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  reopenBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10 },
  reopenText:     { fontSize: 12, fontWeight: '700', color: '#6C47FF' },

  bankDetailsBox: { backgroundColor: theme.colors.background, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 18 },
  bankHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  bankHeaderText: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
  bankGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  bankField:      { fontSize: 12, color: theme.colors.textDim, fontWeight: '500' },
  bankVal:        { fontWeight: '800', color: theme.colors.text },
  confirmPayBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6C47FF', paddingVertical: 16, borderRadius: 16, shadowColor: '#6C47FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  confirmPayBtnText:{ fontSize: 15, fontWeight: '800', color: '#fff' },
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
  downloadBtnText:{ fontSize: 14, fontWeight: '800', color: '#fff' },
});


export default CustomerWalletScreen;
