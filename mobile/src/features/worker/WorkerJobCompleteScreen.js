import React, { useState, useEffect, useCallback } from 'react';
import { 
  ScrollView, 
  View, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  StatusBar,
  Platform,
  Alert,
  Modal,
  Image,
  TextInput,
  ActivityIndicator
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';
import { 
  CheckCircle2, 
  Home, 
  Star, 
  QrCode, 
  Banknote, 
  Copy, 
  Check, 
  X, 
  AlertTriangle 
} from 'lucide-react-native';
import { jobService } from '../../services/jobService';
import { walletService } from '../../services/walletService';
import useSocket from '../../hooks/useSocket';
import { useAuth } from '../../context/AuthContext';

const WorkerJobCompleteScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const androidHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const safeTop = Math.max(insets.top, androidHeight) > 0 ? Math.max(insets.top, androidHeight) : 16;
  const styles = createStyles(theme, isDarkMode, safeTop);

  const { job: initialJob, quoteAmount } = route.params || {};
  const [currentJob, setCurrentJob] = useState(initialJob);
  const [confirmingCash, setConfirmingCash] = useState(false);

  // Digital COD UPI QR State
  const [showQrModal, setShowQrModal] = useState(false);
  const [adminUpiConfig, setAdminUpiConfig] = useState(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [utrInput, setUtrInput] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);

  const activeJob = currentJob || initialJob;
  const jobId = activeJob?._id;

  const quotePayout = quoteAmount || activeJob?.payment?.workerPayout || activeJob?.payment?.amount || activeJob?.budget || 0;
  const completionPin = activeJob?.security?.completionOtp ? String(activeJob.security.completionOtp) : '';
  const isPaid = activeJob?.status === 'PAID' || activeJob?.status === 'CLOSED' || activeJob?.payment?.status === 'PAID';
  const isCashPending = activeJob?.payment?.cashPending === true || activeJob?.payment?.status === 'PENDING_CONFIRMATION';
  const earning = quotePayout;

  const promoDiscount = activeJob?.promoDiscount || 0;
  const totalPayable = Math.max(0, Number(activeJob?.payment?.amount || quotePayout) - promoDiscount);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await jobService.getJobById(jobId);
      if (res?.data?.status === 'success' && res.data.data) {
        setCurrentJob(res.data.data);
      }
    } catch (e) {
      // silently ignore refresh error
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Poll while awaiting cash confirmation or payment
  useEffect(() => {
    if (isPaid) return undefined;
    const interval = setInterval(fetchJob, 4000);
    return () => clearInterval(interval);
  }, [isPaid, fetchJob]);

  // Listen for real-time payment updates
  useSocket({
    role: 'WORKER',
    userId: user?._id || user?.id,
    onEvent: (event, data) => {
      if ((event === 'JOB_PAID' || event === 'CASH_PAYMENT_PENDING' || event === 'JOB_STATUS_CHANGED') &&
          (!data?.jobId || String(data.jobId) === String(jobId))) {
        fetchJob();
      }
    }
  });

  // Fetch admin UPI configuration for Digital COD QR
  const loadUpiConfig = async () => {
    try {
      const res = await walletService.getAdminUpiConfig();
      if (res?.data?.status === 'success') {
        setAdminUpiConfig(res.data.data);
      }
    } catch (e) {
      console.warn('[WorkerJobComplete] upi config error:', e?.message);
    }
  };

  const openQrModal = () => {
    loadUpiConfig();
    setShowQrModal(true);
  };

  const handleCopyUpi = (vpa) => {
    if (!vpa) return;
    Clipboard.setString(vpa);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  // Two-Way Cash Handshake: Worker confirms cash received in hand
  const handleConfirmCash = () => {
    Alert.alert(
      'Confirm Cash Received',
      `Have you collected ₹${totalPayable.toFixed(2)} in physical cash from the customer?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Cash Received',
          style: 'default',
          onPress: async () => {
            setConfirmingCash(true);
            try {
              const res = await jobService.confirmCashPayment(jobId, {
                completionOtp: completionPin
              });
              if (res?.data?.status === 'success') {
                setCurrentJob(res.data.data);
                Alert.alert('Payment Received! 🎉', `₹${earning} has been settled and credited to your wallet.`);
              }
            } catch (err) {
              Alert.alert('Could Not Confirm', err?.response?.data?.message || err?.message || 'Failed to confirm cash payment.');
            } finally {
              setConfirmingCash(false);
            }
          }
        }
      ]
    );
  };

  // Digital COD: Submit UTR on-spot if customer scans QR and transfers directly
  const handleSubmitUtr = async () => {
    const cleanUtr = utrInput.trim();
    if (!/^\d{12}$/.test(cleanUtr)) {
      return Alert.alert('Invalid UTR', 'Please enter the exact 12-digit UPI Reference Number from customer receipt.');
    }
    setSubmittingUtr(true);
    try {
      const res = await jobService.payForJob(jobId, {
        method: 'UPI',
        utrNumber: cleanUtr,
        completionOtp: completionPin
      });
      if (res?.data?.status === 'success') {
        setCurrentJob(res.data.data);
        setShowQrModal(false);
        setUtrInput('');
        Alert.alert('UPI Payment Submitted', 'The 12-digit UTR has been submitted. The job will be settled upon bank verification.');
      }
    } catch (e) {
      Alert.alert('Submission Error', e?.response?.data?.message || e?.message || 'Failed to submit UPI reference.');
    } finally {
      setSubmittingUtr(false);
    }
  };

  const platformVpa = (adminUpiConfig?.upiId || 'kwickly@upi').trim();
  const platformPayee = (adminUpiConfig?.payeeName || 'Kwickly PVT LTD').trim();
  const shortId = String(jobId || '').slice(-6).toUpperCase();
  const upiIntentUri = `upi://pay?pa=${platformVpa}&pn=${encodeURIComponent(platformPayee)}&am=${totalPayable.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Job #' + shortId)}&tr=KWIK${shortId}${Date.now().toString().slice(-4)}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(upiIntentUri)}`;

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor="transparent" 
        translucent 
      />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Header Text */}
        <View style={styles.headerBox}>
          <View style={[styles.successBadge, isPaid && { backgroundColor: '#ECFDF5' }]}>
            <CheckCircle2 size={16} color={isPaid ? '#10B981' : '#F59E0B'} style={{ marginRight: 6 }} />
            <Text style={[styles.successBadgeText, isPaid && { color: '#059669' }]}>
              {isPaid ? 'PAYMENT RECEIVED & SETTLED' : (isCashPending ? 'CASH PAYMENT REQUESTED' : 'WORK MARKED COMPLETED')}
            </Text>
          </View>
          <Text style={styles.mainTitle}>{isPaid ? 'Job Settled!' : 'Job Complete!'}</Text>
          <Text style={styles.mainSub}>
            {isPaid ? 'Your earning has been settled and credited to your wallet' : (isCashPending ? 'Customer is paying cash. Collect and confirm receipt.' : 'Share the completion PIN with the customer so they can pay')}
          </Text>
        </View>

        {/* ── TWO-WAY CASH HANDSHAKE CARD ── */}
        {!isPaid && (
          <View style={[styles.cashHandshakeCard, isCashPending && styles.cashHandshakeCardActive]}>
            <View style={styles.cashCardHeader}>
              <View style={[styles.cashIconWrap, isCashPending && { backgroundColor: '#F59E0B22' }]}>
                <Banknote size={22} color={isCashPending ? '#D97706' : '#6C47FF'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cashCardTitle}>
                  {isCashPending ? 'Customer Paying in Cash' : 'Cash Collection'}
                </Text>
                <Text style={styles.cashCardSub}>
                  {isCashPending ? `Collect ₹${totalPayable.toFixed(2)} physical cash` : 'Collect cash or show UPI QR code'}
                </Text>
              </View>
              <Text style={styles.cashAmountBadge}>₹{totalPayable.toFixed(2)}</Text>
            </View>

            {isCashPending && (
              <View style={styles.cashNoticeBox}>
                <Text style={styles.cashNoticeText}>
                  ⚠️ Only tap "Confirm Cash Received" AFTER physical cash is handed over to you.
                </Text>
              </View>
            )}

            <View style={styles.cashActionRow}>
              <TouchableOpacity
                style={[styles.confirmCashBtn, isCashPending && styles.confirmCashBtnActive]}
                onPress={handleConfirmCash}
                disabled={confirmingCash}
                activeOpacity={0.85}
              >
                {confirmingCash ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <CheckCircle2 size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.confirmCashBtnText}>
                      {isCashPending ? 'Confirm Cash Received' : 'Collect Cash (Handshake)'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.qrLaunchBtn}
                onPress={openQrModal}
                activeOpacity={0.8}
              >
                <QrCode size={18} color="#6C47FF" />
                <Text style={styles.qrLaunchBtnText}>Digital COD (UPI QR)</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.disputeLink}
              onPress={() => navigation.navigate('WorkerRateCustomer', {
                jobId: activeJob?._id,
                customerName: activeJob?.customerId?.name,
                isDispute: true
              })}
            >
              <Text style={styles.disputeLinkText}>Customer underpaid? Report partial payment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Celebration Graphic */}
        <View style={styles.graphicBox}>
          <Text style={styles.graphicEmoji}>🎉</Text>
          <Text style={styles.congratsText}>Great job, partner!</Text>
          <Text style={styles.congratsSub}>
            {isPaid 
              ? 'Your earning has been settled into your Kwickly wallet' 
              : 'Share the completion PIN with the customer or confirm cash payment'}
          </Text>
        </View>

        {/* Completion PIN: the customer enters it to pay, keep visible while unpaid */}
        {!isPaid && completionPin ? (
          <View style={[styles.pricingBox, { alignItems: 'center' }]}>
            <Text style={styles.priceLabel}>Completion PIN for customer</Text>
            <Text style={styles.pinText}>{completionPin}</Text>
          </View>
        ) : null}

        {/* Pricing Summary (0% Partner Commission) */}
        <View style={styles.pricingBox}>
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>Agreed Quote</Text>
              <Text style={styles.priceSub}>Platform Fee (0% Partner Commission)</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.priceValPositive}>₹{quotePayout}</Text>
              <Text style={[styles.priceValNegative, { color: '#10B981' }]}>₹0</Text>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.earningLabel}>Your Net Earning</Text>
              <Text style={styles.earningNote}>100% credited directly to your wallet</Text>
            </View>
            <Text style={styles.earningVal}>₹{earning}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.doneBtn} 
            onPress={() => navigation.navigate('Dashboard')}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={['#6C47FF', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.doneBtnGradient}
            >
              <Home size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.doneBtnText}>Back to Home</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.rateBtn}
            onPress={() => navigation.navigate('WorkerRateCustomer', {
              jobId: activeJob?._id,
              customerName: activeJob?.customerId?.name
            })}
            activeOpacity={0.8}
          >
            <Star size={18} color="#6C47FF" style={{ marginRight: 8 }} />
            <Text style={styles.rateBtnText}>Rate Customer →</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── DIGITAL COD MODAL (DYNAMIC UPI QR) ── */}
      <Modal
        visible={showQrModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQrModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.qrModalCard}>
            <View style={styles.qrModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <QrCode size={22} color="#6C47FF" />
                <Text style={styles.qrModalTitle}>Digital COD (UPI QR)</Text>
              </View>
              <TouchableOpacity onPress={() => setShowQrModal(false)} style={{ padding: 4 }}>
                <X size={20} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>

            <Text style={styles.qrModalSub}>
              Ask customer to scan with any UPI app (GPay, PhonePe, Paytm, BHIM) to pay instantly.
            </Text>

            <View style={styles.qrImageWrapper}>
              <Image 
                source={{ uri: qrImageUrl }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.qrAmountBox}>
              <Text style={styles.qrAmountLabel}>Payable Amount</Text>
              <Text style={styles.qrAmountValue}>₹{totalPayable.toFixed(2)}</Text>
            </View>

            <TouchableOpacity 
              style={styles.vpaRow}
              onPress={() => handleCopyUpi(platformVpa)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.vpaLabel}>UPI ID: {platformVpa}</Text>
                <Text style={styles.vpaPayee}>Payee: {platformPayee}</Text>
              </View>
              {copiedUpi ? (
                <Check size={18} color="#10B981" />
              ) : (
                <Copy size={18} color="#6C47FF" />
              )}
            </TouchableOpacity>

            <View style={styles.utrSection}>
              <Text style={styles.utrLabel}>Customer Paid? Enter 12-digit UTR:</Text>
              <View style={styles.utrInputRow}>
                <TextInput
                  style={styles.utrInput}
                  placeholder="e.g. 523456789012"
                  placeholderTextColor={theme.colors.textDim}
                  keyboardType="numeric"
                  maxLength={12}
                  value={utrInput}
                  onChangeText={setUtrInput}
                />
                <TouchableOpacity
                  style={[styles.utrSubmitBtn, (utrInput.length !== 12 || submittingUtr) && { opacity: 0.5 }]}
                  disabled={utrInput.length !== 12 || submittingUtr}
                  onPress={handleSubmitUtr}
                >
                  {submittingUtr ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.utrSubmitText}>Verify</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (theme, isDarkMode, safeTop) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC' 
  },
  scrollContent: { 
    paddingHorizontal: 20, 
    paddingTop: safeTop + 20 
  },
  headerBox: {
    marginBottom: 20,
    alignItems: 'center',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 10,
  },
  successBadgeText: {
    color: '#D97706',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
  },
  mainSub: {
    fontSize: 13.5,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },

  // Two-Way Cash Handshake Styles
  cashHandshakeCard: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3
  },
  cashHandshakeCardActive: {
    borderColor: '#F59E0B',
    backgroundColor: isDarkMode ? '#241B0E' : '#FFFDF5'
  },
  cashCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12
  },
  cashIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(108,71,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  cashCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B'
  },
  cashCardSub: {
    fontSize: 12,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 2
  },
  cashAmountBadge: {
    fontSize: 18,
    fontWeight: '900',
    color: '#10B981'
  },
  cashNoticeBox: {
    backgroundColor: isDarkMode ? '#3A270D' : '#FEF3C7',
    padding: 10,
    borderRadius: 12,
    marginBottom: 14
  },
  cashNoticeText: {
    fontSize: 11.5,
    color: '#B45309',
    fontWeight: '700',
    lineHeight: 16
  },
  cashActionRow: {
    flexDirection: 'column',
    gap: 10
  },
  confirmCashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C47FF',
    paddingVertical: 14,
    borderRadius: 14
  },
  confirmCashBtnActive: {
    backgroundColor: '#10B981'
  },
  confirmCashBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800'
  },
  qrLaunchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#CBD5E1'
  },
  qrLaunchBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#6C47FF'
  },
  disputeLink: {
    marginTop: 12,
    alignItems: 'center'
  },
  disputeLinkText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#EF4444'
  },

  graphicBox: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    padding: 20,
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#EEF2F6',
  },
  graphicEmoji: {
    fontSize: 54,
    marginBottom: 8,
  },
  congratsText: {
    fontSize: 19,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    marginBottom: 4,
  },
  congratsSub: {
    fontSize: 12,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    textAlign: 'center',
    lineHeight: 17
  },
  pinText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 10,
    color: '#6C47FF',
    marginTop: 8
  },
  pricingBox: {
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', 
    padding: 20, 
    borderRadius: 22,
    borderWidth: 1.2, 
    borderColor: isDarkMode ? '#334155' : '#EEF2F6', 
    marginBottom: 24,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, 
    shadowRadius: 8, 
    elevation: 2
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 15, fontWeight: '700', color: isDarkMode ? '#F8FAFC' : '#1E293B' },
  priceSub: { fontSize: 11.5, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 3 },
  priceValPositive: { fontSize: 16, fontWeight: '800', color: isDarkMode ? '#F8FAFC' : '#1E293B' },
  priceValNegative: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  divider: { height: 1, backgroundColor: isDarkMode ? '#334155' : '#F1F5F9', marginVertical: 14 },
  earningLabel: { fontSize: 16, fontWeight: '800', color: isDarkMode ? '#F8FAFC' : '#1E293B' },
  earningNote: { fontSize: 11, color: '#10B981', marginTop: 3, fontWeight: '600' },
  earningVal: { fontSize: 24, fontWeight: '900', color: '#10B981' },
  actionsContainer: {
    gap: 12,
  },
  doneBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  doneBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
  },
  rateBtnText: {
    color: '#6C47FF',
    fontSize: 15,
    fontWeight: '800',
  },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  qrModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#E2E8F0'
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  qrModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: isDarkMode ? '#F8FAFC' : '#1E293B'
  },
  qrModalSub: {
    fontSize: 12,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    lineHeight: 16,
    marginBottom: 14
  },
  qrImageWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 14
  },
  qrImage: {
    width: 200,
    height: 200
  },
  qrAmountBox: {
    alignItems: 'center',
    marginBottom: 12
  },
  qrAmountLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: isDarkMode ? '#94A3B8' : '#64748B',
    textTransform: 'uppercase'
  },
  qrAmountValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#10B981',
    marginTop: 2
  },
  vpaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14
  },
  vpaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: isDarkMode ? '#F8FAFC' : '#1E293B'
  },
  vpaPayee: {
    fontSize: 11,
    color: isDarkMode ? '#94A3B8' : '#64748B',
    marginTop: 2
  },
  utrSection: {
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? '#334155' : '#E2E8F0',
    paddingTop: 12
  },
  utrLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    marginBottom: 8
  },
  utrInputRow: {
    flexDirection: 'row',
    gap: 8
  },
  utrInput: {
    flex: 1,
    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
    borderWidth: 1,
    borderColor: isDarkMode ? '#334155' : '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: isDarkMode ? '#F8FAFC' : '#1E293B',
    letterSpacing: 1
  },
  utrSubmitBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  utrSubmitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  }
});

export default WorkerJobCompleteScreen;
