import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ActivityIndicator, TextInput, Animated, Easing, Platform,
  KeyboardAvoidingView, Alert, DeviceEventEmitter
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import useSocket, { useSocket as useSocketNamed } from '../hooks/useSocket';
import { walletService } from '../services/walletService';
import { isValidUtr } from '../utils/upiValidation';
import { CheckCircle2, Clock, ShieldCheck, X, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react-native';

const TOTAL_COUNTDOWN_SECONDS = 120;
const resolveUseSocket = useSocket || useSocketNamed;

/**
 * UpiPaymentWaitingModal
 * Real-time bank payment verification modal.
 * Shows an animated loading spinner, countdown timer, WebSocket listener,
 * polling fallback, and manual 12-digit UTR submission.
 */
const UpiPaymentWaitingModal = ({
  visible,
  onClose,
  onSuccess,
  amount,
  orderId,
  payeeName = 'Kwickly Admin',
  upiVpa = '',
  purpose = 'wallet_topup', // 'wallet_topup' | 'subscription' | 'shop_order'
  planTitle = '',
  onSubmitManualUtr
}) => {
  const { theme, isDarkMode } = useTheme();

  const [timeLeft, setTimeLeft] = useState(TOTAL_COUNTDOWN_SECONDS);
  const [status, setStatus] = useState('WAITING'); // 'WAITING' | 'SUCCESS' | 'TIMEOUT'
  const [showManualUtr, setShowManualUtr] = useState(false);
  const [utrInput, setUtrInput] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [statusNote, setStatusNote] = useState('Waiting for bank settlement...');

  // Pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;

    // Reset state on open
    setTimeLeft(TOTAL_COUNTDOWN_SECONDS);
    setStatus('WAITING');
    setShowManualUtr(true);
    setUtrInput('');
    setStatusNote('Waiting for bank settlement...');

    // Start pulsing animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    // 1-second countdown interval
    const countdownInterval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setStatus(curr => curr === 'WAITING' ? 'TIMEOUT' : curr);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      pulse.stop();
      clearInterval(countdownInterval);
    };
  }, [visible]);

  // Polling fallback to /payments/status/:orderId
  useEffect(() => {
    if (!visible || status !== 'WAITING' || !orderId) return;

    let isMounted = true;
    const pollInterval = setInterval(async () => {
      try {
        const res = await walletService.checkPaymentStatus(orderId);
        if (!isMounted) return;

        const data = res?.data?.data;
        if (data?.status === 'COMPLETED' && data?.verified === true) {
          clearInterval(pollInterval);
          handleTriggerSuccess(data);
        }
      } catch (err) {
        // Silently retry on next poll cycle
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [visible, status, orderId]);

  const handleTriggerSuccess = useCallback((data) => {
    setStatus('SUCCESS');
    setStatusNote('Bank payment confirmed! Credit applied.');
    if (onSuccess) {
      try { onSuccess(data); } catch (e) { console.warn(e); }
    }
    setTimeout(() => {
      if (onClose) onClose();
    }, 2000);
  }, [onSuccess, onClose]);

  // Real-time WebSocket listener via useSocket onEvent
  const handleSocketEvent = useCallback((event, payload) => {
    if (!visible || status !== 'WAITING') return;

    if (event === 'WALLET_UPDATE') {
      if (payload?.type === 'TOPUP' && (Number(payload?.amount) === Number(amount) || !amount)) {
        handleTriggerSuccess(payload);
      }
    } else if (event === 'WALLET_TOPUP_APPROVED') {
      handleTriggerSuccess(payload);
    } else if (event === 'SUBSCRIPTION_ACTIVATED') {
      if (purpose === 'subscription') {
        handleTriggerSuccess(payload);
      }
    } else if (event === 'ORDER_STATUS') {
      if (payload?.paymentStatus === 'PAID') {
        handleTriggerSuccess(payload);
      }
    }
  }, [visible, status, amount, purpose, handleTriggerSuccess]);

  resolveUseSocket({ onEvent: handleSocketEvent });

  // Real-time Bank SMS Interception Listener
  useEffect(() => {
    if (!visible || status !== 'WAITING') return;

    const sub = DeviceEventEmitter.addListener('onBankSmsReceived', async (event) => {
      console.log('[WaitingModal] onBankSmsReceived caught:', JSON.stringify(event));
      if (event?.utr && /^\d{12}$/.test(event.utr)) {
        setStatusNote(`Bank SMS detected (Ref: ${event.utr}) • Verifying...`);
        setUtrInput(event.utr);
        setSubmittingUtr(true);
        try {
          if (onSubmitManualUtr) {
            const res = await onSubmitManualUtr(event.utr);
            if (res?.verified === true || res?.status === 'COMPLETED') {
              handleTriggerSuccess(res);
            }
          }
        } catch (err) {
          console.warn('[WaitingModal] Auto-verify with SMS UTR failed:', err?.message);
        } finally {
          setSubmittingUtr(false);
        }
      }
    });

    return () => {
      sub.remove();
    };
  }, [visible, status, onSubmitManualUtr, handleTriggerSuccess]);

  const handleCancelAndClose = async () => {
    if (orderId) {
      try {
        await walletService.cancelPayment({
          razorpayOrderId: orderId,
          reason: 'Cancelled by user in app'
        });
      } catch (e) {}
    }
    if (onClose) onClose();
  };

  const handleManualUtrSubmit = async () => {
    const clean = utrInput.trim();
    if (!isValidUtr(clean)) {
      Alert.alert('Invalid UTR', 'Please enter the exact 12-digit UPI Reference / UTR Number from your bank receipt or SMS.');
      return;
    }

    setSubmittingUtr(true);
    try {
      if (onSubmitManualUtr) {
        const res = await onSubmitManualUtr(clean);
        if (res?.verified === true && res?.status === 'COMPLETED') {
          handleTriggerSuccess(res);
          return;
        }
      }

      // Check status immediately
      if (orderId) {
        const checkRes = await walletService.checkPaymentStatus(orderId);
        if (checkRes?.data?.data?.status === 'COMPLETED' && checkRes?.data?.data?.verified === true) {
          handleTriggerSuccess(checkRes.data.data);
          return;
        }
      }

      setStatusNote('UTR submitted. Verifying with bank settlement...');
      setShowManualUtr(false);
    } catch (err) {
      Alert.alert('Verification Issue', err?.response?.data?.message || err?.message || 'Could not verify UTR. Please check the 12 digits.');
    } finally {
      setSubmittingUtr(false);
    }
  };

  if (!visible) return null;

  const styles = createStyles(theme, isDarkMode);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.secureBadge}>
              <ShieldCheck size={14} color="#10B981" />
              <Text style={styles.secureBadgeText}>Bank Direct UPI</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color={theme.colors.textSecondary || '#6B7280'} />
            </TouchableOpacity>
          </View>

          {/* Body based on status */}
          {status === 'SUCCESS' ? (
            <View style={styles.successContainer}>
              <View style={styles.successIconCircle}>
                <CheckCircle2 size={48} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>Payment Verified! 🎉</Text>
              <Text style={styles.successSub}>
                {purpose === 'subscription'
                  ? `Your ${planTitle || 'subscription'} is now active!`
                  : `₹${amount} has been securely added to your wallet.`}
              </Text>
              <TouchableOpacity
                style={[styles.doneBtn, { marginTop: 18, width: '100%' }]}
                onPress={onClose}
                activeOpacity={0.85}
              >
                <Text style={styles.doneBtnText}>Done • View Wallet</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.waitingContainer}>
              {/* Radar Pulse Animation */}
              <View style={styles.radarWrapper}>
                <Animated.View
                  style={[
                    styles.radarPulse,
                    { transform: [{ scale: pulseAnim }] }
                  ]}
                />
                <View style={styles.radarCenter}>
                  <ActivityIndicator size="small" color="#6C47FF" />
                </View>
              </View>

              <Text style={styles.waitingTitle}>
                {status === 'TIMEOUT' ? 'Settlement in Progress' : 'Verifying with Bank...'}
              </Text>
              <Text style={styles.waitingSub}>
                {status === 'TIMEOUT'
                  ? 'Your payment was submitted. Bank settlement usually completes in 1-2 minutes. Your balance will update automatically.'
                  : statusNote}
              </Text>

              {/* Amount and Timer Pill */}
              <View style={styles.infoRow}>
                <View style={styles.infoPill}>
                  <Text style={styles.infoPillLabel}>Amount</Text>
                  <Text style={styles.infoPillValue}>₹{amount}</Text>
                </View>
                {status === 'WAITING' && (
                  <View style={[styles.infoPill, styles.timerPill]}>
                    <Clock size={14} color="#6C47FF" />
                    <Text style={styles.timerText}>{timeLeft}s left</Text>
                  </View>
                )}
              </View>

              {/* Payee Details */}
              {Boolean(upiVpa) && (
                <View style={styles.payeeCard}>
                  <Text style={styles.payeeLabel}>Transfer Recipient (Admin):</Text>
                  <Text style={styles.payeeName} numberOfLines={1}>{payeeName}</Text>
                  <Text style={styles.payeeVpa}>{upiVpa}</Text>
                </View>
              )}

              {/* Manual UTR Accordion */}
              <TouchableOpacity
                style={styles.manualAccordionBtn}
                onPress={() => setShowManualUtr(prev => !prev)}
                activeOpacity={0.7}
              >
                <Text style={styles.manualAccordionText}>
                  {showManualUtr ? 'Hide UTR Entry' : 'Already Paid? Enter 12-digit UTR'}
                </Text>
                {showManualUtr ? (
                  <ChevronUp size={16} color="#6C47FF" />
                ) : (
                  <ChevronDown size={16} color="#6C47FF" />
                )}
              </TouchableOpacity>

              {showManualUtr && (
                <View style={styles.manualUtrBox}>
                  <Text style={styles.utrInputLabel}>12-digit UPI Ref / UTR Number:</Text>
                  <View style={styles.utrInputRow}>
                    <TextInput
                      style={styles.utrInput}
                      placeholder="e.g. 429182736152"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      maxLength={12}
                      value={utrInput}
                      onChangeText={setUtrInput}
                    />
                    <TouchableOpacity
                      style={[styles.submitUtrBtn, utrInput.length !== 12 && styles.submitUtrBtnDisabled]}
                      disabled={utrInput.length !== 12 || submittingUtr}
                      onPress={handleManualUtrSubmit}
                      activeOpacity={0.8}
                    >
                      {submittingUtr ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <ArrowRight size={18} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {status === 'WAITING' && (
                <View style={{ width: '100%', marginTop: 14, gap: 8 }}>
                  <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={async () => {
                      const cleanUtr = utrInput.trim();
                      if (!cleanUtr) {
                        Alert.alert(
                          'UTR Required',
                          'Please enter the 12-digit UPI Reference (UTR) Number from your bank SMS or payment receipt to verify.'
                        );
                        return;
                      }
                      handleManualUtrSubmit();
                    }}
                    disabled={submittingUtr}
                    activeOpacity={0.85}
                  >
                    {submittingUtr ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.doneBtnText}>Verify UTR & Credit Wallet</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 16 }}
                    onPress={handleCancelAndClose}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 13, color: '#9CA3AF', fontWeight: '700' }}>
                      Cancel / Did Not Pay
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {status === 'TIMEOUT' && (
                <View style={{ width: '100%', marginTop: 14, gap: 8 }}>
                  <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={async () => {
                      const cleanUtr = utrInput.trim();
                      if (!cleanUtr) {
                        Alert.alert(
                          'UTR Required',
                          'Please enter the 12-digit UPI Reference (UTR) Number from your bank SMS or payment receipt to verify.'
                        );
                        return;
                      }
                      handleManualUtrSubmit();
                    }}
                    disabled={submittingUtr}
                    activeOpacity={0.85}
                  >
                    {submittingUtr ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.doneBtnText}>Verify UTR & Credit Wallet</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 16 }}
                    onPress={onClose}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 13, color: '#9CA3AF', fontWeight: '700' }}>
                      Close
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: isDarkMode ? '#1E1E2E' : '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  secureBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  closeBtn: {
    padding: 4,
  },
  waitingContainer: {
    alignItems: 'center',
  },
  radarWrapper: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  radarPulse: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(108, 71, 255, 0.15)',
  },
  radarCenter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: isDarkMode ? '#2D2B52' : '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text || '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  waitingSub: {
    fontSize: 13,
    color: theme.colors.textSecondary || '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    width: '100%',
  },
  infoPill: {
    flex: 1,
    backgroundColor: isDarkMode ? '#28273D' : '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  infoPillLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary || '#6B7280',
    fontWeight: '600',
    marginBottom: 2,
  },
  infoPillValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#10B981',
  },
  timerPill: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6C47FF',
  },
  payeeCard: {
    width: '100%',
    backgroundColor: isDarkMode ? '#252438' : '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? '#373552' : '#E5E7EB',
    marginBottom: 14,
  },
  payeeLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary || '#6B7280',
    fontWeight: '600',
    marginBottom: 2,
  },
  payeeName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text || '#111827',
  },
  payeeVpa: {
    fontSize: 12,
    color: '#6C47FF',
    fontWeight: '600',
    marginTop: 2,
  },
  manualAccordionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
    marginBottom: 8,
  },
  manualAccordionText: {
    fontSize: 13,
    color: '#6C47FF',
    fontWeight: '600',
  },
  manualUtrBox: {
    width: '100%',
    backgroundColor: isDarkMode ? '#252438' : '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? '#3E3C5E' : '#E5E7EB',
    marginBottom: 10,
  },
  utrInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary || '#6B7280',
    marginBottom: 8,
  },
  utrInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  utrInput: {
    flex: 1,
    backgroundColor: isDarkMode ? '#1E1E2E' : '#FFFFFF',
    borderWidth: 1,
    borderColor: isDarkMode ? '#3E3C5E' : '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text || '#111827',
    letterSpacing: 1,
  },
  submitUtrBtn: {
    backgroundColor: '#6C47FF',
    borderRadius: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitUtrBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  doneBtn: {
    width: '100%',
    backgroundColor: '#6C47FF',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSub: {
    fontSize: 14,
    color: theme.colors.textSecondary || '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default UpiPaymentWaitingModal;
