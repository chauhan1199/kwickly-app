import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  Platform,
  TextInput,
  Image,
  Modal,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  AppState
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';
import { jobService } from '../../services/jobService';
import { walletService } from '../../services/walletService';
import { nativeUpiService } from '../../services/nativeUpiService';
import UpiPaymentWaitingModal from '../../components/UpiPaymentWaitingModal';
import useSocket from '../../hooks/useSocket';
import { isValidUtr } from '../../utils/upiValidation';
import api from '../../services/api';
import CustomAlert from '../../components/ui/CustomAlert';
import { getImageUrl } from '../../utils/helpers';
import {
  ChevronLeft,
  Bell,
  CheckCircle2,
  ShieldCheck,
  Tag,
  Lock,
  DollarSign,
  CreditCard,
  Banknote,
  ImageIcon,
  X,
  Zap
} from 'lucide-react-native';
import { calculateJobFee } from '../../utils/fees';

const WorkCompletedScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  const { worker, job } = route.params || {};
  const [currentJob, setCurrentJob] = useState(job || null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLatestJob = useCallback(async () => {
    const targetId = currentJob?._id || job?._id;
    if (!targetId) return;
    try {
      const res = await jobService.getJobById(targetId);
      if (res.data?.data) {
        setCurrentJob(res.data.data);
      }
    } catch (e) {
      console.log('[WorkCompleted] Refresh error:', e.message);
    }
  }, [currentJob?._id, job?._id]);

  useEffect(() => {
    fetchLatestJob();
  }, [fetchLatestJob]);

  const activeJob = currentJob || job;
  const workerName = worker?.name || activeJob?.workerId?.name || activeJob?.workerName || 'Technician';

  // Dynamic Financial Calculations from Job Data
  const workerPayout = Number(activeJob?.payment?.workerPayout || activeJob?.quote?.amount || activeJob?.price || activeJob?.budget || 0);
  // Server stores the fee on quote acceptance; recompute with the same rules only if it's missing
  const fallbackFee = calculateJobFee(workerPayout);
  const platformFee = activeJob?.payment?.platformFee !== undefined
    ? Number(activeJob.payment.platformFee)
    : (activeJob?.platformFee !== undefined ? Number(activeJob.platformFee) : fallbackFee.platformFee);
  const gst = activeJob?.payment?.gst !== undefined
    ? Number(activeJob.payment.gst)
    : (activeJob?.gst !== undefined ? Number(activeJob.gst) : fallbackFee.gstAmount);
  const totalAmount = activeJob?.payment?.amount 
    ? Number(activeJob.payment.amount) 
    : (workerPayout > 0 ? (workerPayout + platformFee + gst) : 0);
  const workerEarning = workerPayout;
  const jobAmount = totalAmount;

  const isPaidOrClosed = activeJob?.status === 'PAID' || activeJob?.status === 'CLOSED' || activeJob?.payment?.status === 'PAID';
  const isPendingVerification = activeJob?.payment?.status === 'PENDING_VERIFICATION';
  const isCashPending = activeJob?.payment?.cashPending === true || activeJob?.payment?.status === 'PENDING_CONFIRMATION';
  const isInProgress = activeJob?.status === 'IN_PROGRESS';

  // Live refresh: the job turns PAID when its UPI payment is matched or cash is confirmed
  const paidAlertShownRef = useRef(false);
  const upiSubmittedRef = useRef(false);
  const handleSocketEvent = useCallback((event, data) => {
    const targetId = currentJob?._id || job?._id;
    if (!targetId || String(data?.jobId) !== String(targetId)) return;
    if (event === 'JOB_PAID' || event === 'JOB_STATUS_CHANGED') fetchLatestJob();
  }, [currentJob?._id, job?._id, fetchLatestJob]);
  useSocket({ onEvent: handleSocketEvent });

  // While payment awaits UPI verification or worker cash confirmation, poll periodically
  useEffect(() => {
    if (!isPendingVerification && !isCashPending) return undefined;
    const timer = setInterval(fetchLatestJob, 5000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchLatestJob();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [isPendingVerification, isCashPending, fetchLatestJob]);

  const [otp, setOtp] = useState('');
  const scrollRef = useRef(null);
  const [paying, setPaying] = useState(false);
  const [upiConfig, setUpiConfig] = useState(null);
  const [showUpiWaiting, setShowUpiWaiting] = useState(false);
  
  const [promoInput, setPromoInput] = useState('');
  const [promoCode, setPromoCode] = useState(null);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoLoading, setPromoLoading] = useState(false);

  // Zoom preview modal for real proof images
  const [zoomImage, setZoomImage] = useState(null);

  // CustomAlert State
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    confirmText: 'OK',
    cancelText: 'Cancel',
    showCancel: false,
    onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false })),
    onCancel: () => setAlertConfig(prev => ({ ...prev, visible: false })),
  });

  const showAlert = (options) => {
    setAlertConfig({
      visible: true,
      title: options.title || '',
      message: options.message || '',
      type: options.type || 'info',
      confirmText: options.confirmText || 'OK',
      cancelText: options.cancelText || 'Cancel',
      showCancel: !!options.showCancel,
      onConfirm: () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
        if (options.onConfirm) options.onConfirm();
      },
      onCancel: () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
        if (options.onCancel) options.onCancel();
      }
    });
  };

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    try {
      const res = await api.post('/promotions/validate', {
        code: promoInput.trim(),
        totalAmount: jobAmount
      });
      if (res.data?.status === 'success') {
        const discount = Number(res.data.data.discountAmount) || 0;
        setPromoCode(promoInput.trim().toUpperCase());
        setPromoDiscount(discount);
        showAlert({
          type: 'success',
          title: 'Promo Applied! 🎉',
          message: `Coupon ${promoInput.trim().toUpperCase()} applied! You saved ₹${discount}.`
        });
      }
    } catch (e) {
      showAlert({
        type: 'error',
        title: 'Invalid Promo',
        message: e.response?.data?.message || 'Failed to apply promo code. Please check and try again.'
      });
    } finally {
      setPromoLoading(false);
    }
  };

  const removePromo = () => {
    setPromoCode(null);
    setPromoDiscount(0);
    setPromoInput('');
  };

  const showPaidAlert = (paidJob) => {
    if (paidAlertShownRef.current) return;
    paidAlertShownRef.current = true;
    showAlert({
      type: 'success',
      title: 'Payment Successful! 🎉',
      message: `Payment of ₹${Math.max(0, totalAmount - promoDiscount)} authorized. ₹${workerEarning} credited directly to ${workerName}'s wallet.`,
      confirmText: 'Rate Experience ⭐',
      onConfirm: () => navigation.navigate('RateExperience', { 
        worker: { name: workerName }, 
        job: paidJob || activeJob, 
        jobId: activeJob?._id 
      })
    });
  };

  // A UPI payment submitted from this screen was confirmed later (bank SMS / admin)
  useEffect(() => {
    if (isPendingVerification) upiSubmittedRef.current = true;
    if (upiSubmittedRef.current && isPaidOrClosed) {
      setShowUpiWaiting(false);
      showPaidAlert(activeJob);
    }
    // Runs only when the payment state changes, not on every re-render of the job
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaidOrClosed, isPendingVerification]);

  const requireOtp = () => {
    if (otp && otp.trim().length === 4) return true;
    showAlert({
      type: 'warning',
      title: 'Completion OTP Required',
      message: `Please enter the 4-digit Completion OTP shared by ${workerName} to authorize fund release.`
    });
    return false;
  };

  // Sends the UTR of a direct-UPI payment. The job is PAID at once only if the bank
  // credit is already recorded; otherwise it waits for verification.
  const submitUpiUtr = async (utr) => {
    const res = await jobService.payForJob(activeJob?._id, {
      method: 'UPI',
      completionOtp: otp.trim(),
      promoCode,
      utrNumber: utr
    });
    if (res?.data?.status !== 'success') {
      throw new Error(res?.data?.message || 'Could not submit the UPI reference. Please try again.');
    }
    upiSubmittedRef.current = true;
    const updated = res.data.data;
    if (updated) setCurrentJob(updated);
    setShowUpiWaiting(false);
    if (updated?.status === 'PAID' || updated?.payment?.status === 'PAID') {
      showPaidAlert(updated);
    } else {
      showAlert({
        type: 'info',
        title: 'Payment Submitted',
        message: `UTR ${utr} received. The job will be marked paid as soon as the payment is verified.`
      });
    }
    return { handled: true };
  };

  const handleUpiPayment = async () => {
    if (!requireOtp()) return;
    setPaying(true);
    let vpa = '';
    let payee = 'Kwickly';
    try {
      const cfgRes = await walletService.getAdminUpiConfig();
      const cfg = cfgRes?.data?.data || {};
      vpa = (cfg.upiId || '').trim();
      payee = (cfg.payeeName || payee).trim().replace(/\s+/g, ' ');
    } catch (e) {
      console.log('[WorkCompleted] UPI config error:', e.message);
    }
    if (!vpa) {
      setPaying(false);
      return showAlert({
        type: 'error',
        title: 'UPI Unavailable',
        message: 'UPI payments are not available right now. Please pay from your wallet or in cash.'
      });
    }
    setUpiConfig({ vpa, payee });

    try {
      const result = await nativeUpiService.startUpiPayment({
        vpa,
        name: payee,
        amount: finalPayable.toFixed(2),
        txnRef: `KWIKJOB${String(activeJob?._id || '').slice(-8)}${Date.now().toString().slice(-4)}`,
        note: 'Job Payment'
      });
      // The UPI app returned the bank reference directly
      const utr = (result?.approvalRefNo || '').trim();
      if (/^\d{12}$/.test(utr) && isValidUtr(utr)) {
        try {
          await submitUpiUtr(utr);
          return;
        } catch (e) {
          console.warn('[WorkCompleted] UPI submit error:', e?.message);
        }
      }
    } catch (err) {
      console.warn('[WorkCompleted] UPI launch notice:', err?.message);
    } finally {
      setPaying(false);
    }
    // Otherwise detect the UTR from the bank SMS / clipboard, or let the customer type it
    setShowUpiWaiting(true);
  };

  const handlePayment = async (method) => {
    if (!requireOtp()) return;

    if (method === 'CASH') {
      setPaying(true);
      try {
        const res = await jobService.requestCashPayment(activeJob?._id, {
          completionOtp: otp.trim(),
          promoCode
        });
        if (res.data?.status === 'success') {
          if (res.data.data) setCurrentJob(res.data.data);
          showAlert({
            type: 'info',
            title: 'Cash Payment Requested 💵',
            message: `Please hand ₹${finalPayable.toFixed(2)} in physical cash to ${workerName}. Once received, they will confirm on their app.`
          });
        }
      } catch (e) {
        showAlert({
          type: 'error',
          title: 'Cash Payment Unavailable',
          message: e.response?.data?.message || 'Failed to request cash payment. Please try paying with UPI or Wallet.'
        });
      } finally {
        setPaying(false);
      }
      return;
    }

    setPaying(true);
    try {
      const res = await jobService.payForJob(activeJob?._id, { 
        method, 
        completionOtp: otp.trim(),
        promoCode 
      });
      if (res.data.status === 'success') {
        showPaidAlert(res.data.data);
      }
    } catch (e) {
      showAlert({
        type: 'error',
        title: 'Payment Authorization Failed',
        message: e.response?.data?.message || 'Invalid Completion OTP or payment authorization error. Please recheck the OTP.'
      });
    } finally {
      setPaying(false);
    }
  };

  const handleCancelCash = async () => {
    try {
      setPaying(true);
      const res = await jobService.cancelCashPayment(activeJob?._id);
      if (res.data?.status === 'success') {
        if (res.data.data) setCurrentJob(res.data.data);
        showAlert({
          type: 'info',
          title: 'Cash Request Cancelled',
          message: 'You can now select another payment method (UPI or Wallet).'
        });
      }
    } catch (e) {
      showAlert({
        type: 'error',
        title: 'Could Not Cancel',
        message: e.response?.data?.message || 'Failed to cancel cash request.'
      });
    } finally {
      setPaying(false);
    }
  };

  const styles = createStyles(theme, isDarkMode, insets);

  // Extract actual media if worker attached proof photos
  const rawMedia = activeJob?.completionDetails?.media || activeJob?.proofImage || activeJob?.media || [];
  const realMedia = Array.isArray(rawMedia) 
    ? rawMedia.filter(m => typeof m === 'string' && m.trim().length > 0)
    : (typeof rawMedia === 'string' && rawMedia.trim().length > 0 ? [rawMedia] : []);

  const finalPayable = Math.max(0, totalAmount - promoDiscount);
  const formattedButtonAmount = Number.isInteger(finalPayable) 
    ? finalPayable.toString() 
    : finalPayable.toFixed(2);

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor="transparent" 
        translucent={true} 
      />
      
      {/* ── TOP APP BAR WITH SAFE INSETS ── */}
      <View style={styles.appBar}>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerTitleWrap}>
          <Text style={styles.appBarTitle} numberOfLines={1}>Work Completed</Text>
          <Text style={styles.appBarSub} numberOfLines={1}>Review & Authorize Payment</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Bell size={18} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Android 15+ draws edge-to-edge, so the window no longer shrinks for the keyboard;
          pad the content instead so the OTP box and pay buttons stay visible */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView 
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={async () => {
              setRefreshing(true);
              await fetchLatestJob();
              setRefreshing(false);
            }} 
          />
        }
      >
        {/* ── 1. COMPLETION PROOF / VERIFICATION ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.sectionIconWrap}>
              <ShieldCheck size={18} color="#6C47FF" />
            </View>
            <Text style={styles.cardTitle}>Completion Proof by {workerName}</Text>
          </View>

          {realMedia.length > 0 ? (
            <View style={styles.mediaGrid}>
              {realMedia.map((item, index) => {
                const imgUri = getImageUrl(item);
                return (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.mediaThumbnail}
                    onPress={() => setZoomImage(imgUri)}
                    activeOpacity={0.8}
                  >
                    <Image 
                      source={{ uri: imgUri }} 
                      style={styles.thumbnailImg} 
                      resizeMode="cover"
                    />
                    <View style={styles.zoomPill}>
                      <Text style={styles.zoomText}>Photo #{index + 1}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.verifiedCard}>
              <View style={styles.verifiedIconWrap}>
                <CheckCircle2 size={22} color="#10B981" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.verifiedTitle}>Service Work Marked Finished</Text>
                <Text style={styles.verifiedSub}>
                  {workerName} completed the task at your location.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── 2. INVOICE & TRANSPARENT BILL DETAILS ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.sectionIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <DollarSign size={18} color="#10B981" />
            </View>
            <Text style={styles.cardTitle}>Bill & Payment Details</Text>
          </View>

          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceText}>Worker Service Charge</Text>
            <Text style={styles.invoiceTextBold}>₹{workerPayout.toFixed(2)}</Text>
          </View>

          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceMuted}>Platform Convenience Fee</Text>
            <Text style={styles.invoiceMuted}>₹{platformFee.toFixed(2)}</Text>
          </View>

          {gst > 0 && (
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceMuted}>GST (18% on platform fee)</Text>
              <Text style={styles.invoiceMuted}>₹{gst.toFixed(2)}</Text>
            </View>
          )}
          
          {promoCode && (
            <View style={[styles.invoiceRow, { marginTop: 4 }]}>
              <Text style={{ color: '#059669', fontWeight: '600', fontSize: 13.5 }}>
                Promo Discount ({promoCode})
              </Text>
              <Text style={{ color: '#059669', fontWeight: '800', fontSize: 14 }}>
                -₹{promoDiscount.toFixed(2)}
              </Text>
            </View>
          )}

          <View style={styles.separator} />
          
          <View style={styles.invoiceTotalRow}>
            <Text style={styles.totalText}>Grand Total</Text>
            <View style={{ alignItems: 'flex-end' }}>
              {promoCode ? (
                <Text style={styles.strikethroughTotal}>₹{totalAmount.toFixed(2)}</Text>
              ) : null}
              <Text style={styles.totalPrice}>₹{finalPayable.toFixed(2)}</Text>
            </View>
          </View>
          
          <View style={styles.autoSplitBadge}>
            <CheckCircle2 size={13} color="#6C47FF" />
            <Text style={styles.autoSplitText}>
              100% of quote (₹{workerEarning.toFixed(2)}) goes directly to {workerName}'s wallet
            </Text>
          </View>
        </View>

        {/* ── 3. PROMO CODE SECTION (only while the bill is still payable) ── */}
        {!isPaidOrClosed && !isPendingVerification && !isCashPending && (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.sectionIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <Tag size={18} color="#F59E0B" />
            </View>
            <Text style={styles.cardTitle}>Apply Promo Code</Text>
          </View>

          <View style={styles.promoRow}>
            <TextInput
              style={styles.promoInput}
              placeholder="Enter discount code"
              placeholderTextColor={theme.colors.textDim}
              value={promoInput}
              onChangeText={setPromoInput}
              editable={!promoCode}
              autoCapitalize="characters"
            />
            {promoCode ? (
              <TouchableOpacity 
                style={styles.promoRemoveBtn} 
                onPress={removePromo}
                activeOpacity={0.7}
              >
                <Text style={styles.promoRemoveText}>Remove</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.promoApplyBtn, promoLoading && { opacity: 0.6 }]} 
                onPress={handleApplyPromo}
                disabled={promoLoading}
                activeOpacity={0.8}
              >
                {promoLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.promoApplyText}>Apply</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
        )}

        {/* ── 4. STATUS-AWARE PAYMENT & AUTHORIZATION SECTION ── */}
        {isPaidOrClosed ? (
          <View style={styles.card}>
            <View style={[styles.cardHeaderRow, { justifyContent: 'center', marginBottom: 10 }]}>
              <View style={[styles.sectionIconWrap, { backgroundColor: '#10B98118' }]}>
                <CheckCircle2 size={24} color="#10B981" />
              </View>
              <Text style={[styles.cardTitle, { color: '#10B981', marginLeft: 8 }]}>Payment Completed</Text>
            </View>
            <Text style={[styles.cardSub, { textAlign: 'center', marginBottom: 16 }]}>
              ₹{totalAmount} has been paid and credited to {workerName}.
            </Text>
            <TouchableOpacity 
              style={[styles.onlineBtnWrap, { width: '100%' }]}
              onPress={() => navigation.navigate('RateExperience', { 
                worker: { name: workerName }, 
                job: activeJob, 
                jobId: activeJob?._id 
              })}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#6C47FF', '#8B6FFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.onlineBtnGradient, { justifyContent: 'center' }]}
              >
                <Text style={styles.onlineBtnText}>Rate Technician Experience ⭐</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : isPendingVerification ? (
          <View style={[styles.card, { borderColor: '#F59E0B40', backgroundColor: isDarkMode ? '#2A1F0C' : '#FEF3C7' }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: '#F59E0B20' }]}>
                <Text style={{ fontSize: 18 }}>⏳</Text>
              </View>
              <Text style={[styles.cardTitle, { color: '#B45309' }]}>Payment Under Verification</Text>
            </View>
            <Text style={[styles.cardSub, { color: isDarkMode ? '#FDE68A' : '#78350F' }]}>
              Your payment is currently being verified by admin. The status will automatically update once verified.
            </Text>
          </View>
        ) : isCashPending ? (
          <View style={[styles.card, { borderColor: '#F59E0B40', backgroundColor: isDarkMode ? '#2A1F0C' : '#FEF3C7' }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: '#F59E0B20' }]}>
                <Text style={{ fontSize: 20 }}>💵</Text>
              </View>
              <Text style={[styles.cardTitle, { color: '#B45309' }]}>Awaiting Cash Confirmation</Text>
            </View>
            <Text style={[styles.cardSub, { color: isDarkMode ? '#FDE68A' : '#78350F', marginBottom: 14 }]}>
              Please hand ₹{formattedButtonAmount} in physical cash to {workerName}. Once received, they will tap "Confirm Cash Received" on their app to complete your payment.
            </Text>
            <TouchableOpacity 
              style={[styles.onlineBtnWrap, { width: '100%', borderColor: '#B45309', borderWidth: 1.2, borderRadius: 14, overflow: 'hidden' }]}
              onPress={handleCancelCash}
              disabled={paying}
              activeOpacity={0.8}
            >
              <View style={{ paddingVertical: 12, alignItems: 'center', backgroundColor: isDarkMode ? '#1E1B15' : '#FFFFFF' }}>
                <Text style={{ color: '#B45309', fontWeight: '800', fontSize: 13 }}>Cancel & Pay via UPI / Wallet</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : isInProgress ? (
          <View style={[styles.card, { borderColor: '#3B82F640', backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF' }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: '#3B82F620' }]}>
                <Text style={{ fontSize: 18 }}>🔨</Text>
              </View>
              <Text style={[styles.cardTitle, { color: '#2563EB' }]}>Work In Progress</Text>
            </View>
            <Text style={[styles.cardSub, { color: isDarkMode ? '#93C5FD' : '#1E40AF' }]}>
              {workerName} is currently working on this service. Once finished, they will complete the job and share the Completion OTP with you to authorize payment.
            </Text>
          </View>
        ) : (
          <>
            {/* ── 4. AUTHORIZE WITH 4-DIGIT COMPLETION OTP ── */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.sectionIconWrap, { backgroundColor: 'rgba(108, 71, 255, 0.12)' }]}>
                  <Lock size={18} color="#6C47FF" />
                </View>
                <Text style={styles.cardTitle}>Authorize Payment Release</Text>
              </View>
              
              <Text style={styles.cardSub}>
                Enter the 4-digit Completion OTP provided by {workerName} to confirm completion and release funds.
              </Text>
              
              <TextInput
                style={styles.otpInput}
                placeholder="• • • •"
                placeholderTextColor={theme.colors.textDim}
                keyboardType="numeric"
                maxLength={4}
                value={otp}
                onChangeText={setOtp}
                onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250)}
                editable={!paying}
              />
            </View>

            {/* ── 5. ACTION BUTTONS ── */}
            {paying ? (
              <View style={styles.payingContainer}>
                <ActivityIndicator size="large" color="#6C47FF" />
                <Text style={styles.payingText}>Authorizing and transferring funds securely...</Text>
              </View>
            ) : (
              <View style={styles.payGrid}>
                <TouchableOpacity 
                  style={styles.cashBtn}
                  onPress={() => handlePayment('CASH')}
                  activeOpacity={0.8}
                >
                  <Banknote size={17} color={theme.colors.text} style={{ marginRight: 6 }} />
                  <Text style={styles.cashBtnText} numberOfLines={1}>Pay via Cash</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.onlineBtnWrap}
                  onPress={() => handlePayment('WALLET')}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#6C47FF', '#8B6FFF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.onlineBtnGradient}
                  >
                    <CreditCard size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.onlineBtnText} numberOfLines={1}>Pay from Wallet ₹{formattedButtonAmount}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
            {!paying && (
              <TouchableOpacity
                style={[styles.onlineBtnWrap, styles.upiBtnWrap]}
                onPress={handleUpiPayment}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#0E9F6E', '#10B981']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.onlineBtnGradient}
                >
                  <Zap size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.onlineBtnText} numberOfLines={1}>Pay via UPI ₹{formattedButtonAmount}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* ── IMAGE ZOOM LIGHTBOX MODAL ── */}
      <Modal
        visible={!!zoomImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setZoomImage(null)}
      >
        <View style={styles.zoomOverlay}>
          <TouchableOpacity 
            style={styles.zoomCloseBtn} 
            onPress={() => setZoomImage(null)}
          >
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {zoomImage ? (
            <Image 
              source={{ uri: zoomImage }} 
              style={styles.zoomedImg} 
              resizeMode="contain" 
            />
          ) : null}
        </View>
      </Modal>

      {/* ── DIRECT UPI: UTR detection / manual entry ── */}
      {showUpiWaiting && (
        <UpiPaymentWaitingModal
          visible={showUpiWaiting}
          onClose={() => setShowUpiWaiting(false)}
          onSuccess={() => { upiSubmittedRef.current = true; fetchLatestJob(); }}
          amount={finalPayable}
          payeeName={upiConfig?.payee}
          upiVpa={upiConfig?.vpa}
          purpose="job_payment"
          jobId={activeJob?._id}
          onSubmitManualUtr={(utr) => submitUpiUtr(utr)}
        />
      )}

      {/* ── RICH CUSTOM ALERT MODAL ── */}
      <CustomAlert
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={alertConfig.confirmText}
        cancelText={alertConfig.cancelText}
        showCancel={alertConfig.showCancel}
        onConfirm={alertConfig.onConfirm}
        onCancel={alertConfig.onCancel}
        onRequestClose={alertConfig.onCancel}
      />
    </View>
  );
};

const createStyles = (theme, isDarkMode, insets) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: Math.max(
      insets?.top || 0,
      Platform.OS === 'android' ? (StatusBar.currentHeight || 36) : 0,
      Platform.OS === 'android' ? 36 : 16
    ),
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
  },
  backBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  appBarTitle: {
    fontSize: 17.5,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.2,
  },
  appBarSub: {
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
    fontWeight: '500',
  },
  iconBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
    marginLeft: 8,
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    backgroundColor: '#6C47FF',
    borderRadius: 4,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: isDarkMode ? '#1E2337' : '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDarkMode ? 0.2 : 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(108, 71, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: theme.colors.text,
    flex: 1,
    flexShrink: 1,
  },
  cardSub: {
    fontSize: 12.5,
    color: theme.colors.textDim,
    lineHeight: 18,
    marginBottom: 14,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  mediaThumbnail: {
    width: 90,
    height: 90,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
  },
  zoomPill: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 6,
    paddingVertical: 2,
    alignItems: 'center',
  },
  zoomText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  verifiedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.18)',
  },
  verifiedIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16,185,129,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: theme.colors.text,
  },
  verifiedSub: {
    fontSize: 11.5,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  invoiceText: {
    color: theme.colors.text,
    fontSize: 13.5,
    fontWeight: '500',
  },
  invoiceTextBold: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  invoiceMuted: {
    color: theme.colors.textDim,
    fontSize: 13,
  },
  separator: {
    height: 1,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    marginVertical: 12,
  },
  invoiceTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  strikethroughTotal: {
    textDecorationLine: 'line-through',
    color: theme.colors.textDim,
    fontSize: 12,
    marginBottom: 2,
  },
  totalPrice: {
    color: '#6C47FF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  autoSplitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(108,71,255,0.08)' : 'rgba(108,71,255,0.05)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(108,71,255,0.12)',
  },
  autoSplitText: {
    color: '#6C47FF',
    fontSize: 11.5,
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
  },
  promoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: theme.colors.text,
    backgroundColor: isDarkMode ? '#141828' : '#F8FAFC',
    fontWeight: '600',
  },
  promoApplyBtn: {
    backgroundColor: '#6C47FF',
    borderRadius: 14,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoApplyText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13.5,
  },
  promoRemoveBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  promoRemoveText: {
    color: '#EF4444',
    fontWeight: '800',
    fontSize: 13,
  },
  otpInput: {
    borderWidth: 1.5,
    borderColor: '#6C47FF',
    borderRadius: 16,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
    backgroundColor: isDarkMode ? '#141828' : '#F8FAFC',
    textAlign: 'center',
    letterSpacing: 14,
  },
  payingContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#1E2337' : '#FFFFFF',
    borderRadius: 20,
    marginBottom: 16,
  },
  payingText: {
    marginTop: 12,
    color: theme.colors.text,
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  payGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    alignItems: 'center',
  },
  cashBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
  },
  cashBtnText: {
    color: theme.colors.text,
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  onlineBtnWrap: {
    flex: 1.55,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  upiBtnWrap: {
    flex: 0,
    width: '100%',
    marginTop: 10,
    shadowColor: '#10B981',
  },
  onlineBtnGradient: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  zoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  zoomedImg: {
    width: '92%',
    height: '80%',
  },
});

export default WorkCompletedScreen;

