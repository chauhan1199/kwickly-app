import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ActivityIndicator, TextInput, Animated, Easing, Platform,
  KeyboardAvoidingView, Alert
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTheme } from '../context/ThemeContext';
import useSocket, { useSocket as useSocketNamed } from '../hooks/useSocket';
import { walletService } from '../services/walletService';
import { nativeUpiService } from '../services/nativeUpiService';
import { isValidUtr } from '../utils/upiValidation';
import { CheckCircle2, Clock, ShieldCheck, X, ArrowRight, Copy } from 'lucide-react-native';

const TOTAL_COUNTDOWN_SECONDS = 30; // 30-second automated verification window
const resolveUseSocket = useSocket || useSocketNamed;

/**
 * UpiPaymentWaitingModal
 * Real-time automated bank payment verification modal.
 * Features:
 * - Immediate auto-detection of 12-digit UTR from Bank SMS & UPI notifications
 * - Native window-focus aware clipboard auto-polling
 * - Prominent, always-visible 12-digit UTR input with 1-tap paste
 * - Auto-submit on 12-digit entry
 * - 30-second verification countdown
 * - Immediate cancellation on "Didn't pay? Cancel"
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
  const [utrInput, setUtrInput] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [statusNote, setStatusNote] = useState('Awaiting automatic bank confirmation...');

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;

    // Reset state on open
    setTimeLeft(TOTAL_COUNTDOWN_SECONDS);
    setStatus('WAITING');
    setUtrInput('');
    setStatusNote('Awaiting automatic bank confirmation via webhook...');

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

    // 1-second countdown interval (30s)
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
        // Silently retry on next cycle
      }
    }, 2000);

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
    }, 1500);
  }, [onSuccess, onClose]);

  // Real-time WebSocket listener
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

  // Intelligent helper to extract 12-digit UTR from any text or bank SMS format
  const extractUtrFromText = useCallback((text) => {
    if (!text || typeof text !== 'string') return null;
    const clean = text.trim();
    // 1. Match Indian bank SMS keywords: UPI Ref, Ref No, UTR, RRN, Txn ID, etc.
    const keywordRegex = /(?:upi\s*(?:ref(?:erence)?|txn(?:action)?(?:\s*id)?)(?:\s*no)?|ref\s*(?:no|id)?|rrn|utr)\D*?(\d{12})/i;
    const match = keywordRegex.exec(clean);
    if (match && isValidUtr(match[1])) return match[1];

    // 2. Standalone 12-digit number (NPCI standard RRN format)
    const standaloneMatch = clean.match(/\b(\d{12})\b/);
    if (standaloneMatch && isValidUtr(standaloneMatch[1])) return standaloneMatch[1];

    return null;
  }, []);

  // Automated UTR Verification Runner
  const autoVerifyUtr = useCallback(async (detectedUtr) => {
    if (!detectedUtr || !isValidUtr(detectedUtr) || submittingUtr) return;
    setSubmittingUtr(true);
    setStatusNote(`Bank UTR ${detectedUtr} detected! Auto-verifying...`);
    try {
      if (onSubmitManualUtr) {
        const res = await onSubmitManualUtr(detectedUtr);
        if (res?.verified === true && res?.status === 'COMPLETED') {
          handleTriggerSuccess(res);
          return;
        }
      }
      if (orderId) {
        const checkRes = await walletService.checkPaymentStatus(orderId);
        if (checkRes?.data?.data?.status === 'COMPLETED' && checkRes?.data?.data?.verified === true) {
          handleTriggerSuccess(checkRes.data.data);
          return;
        }
      }
      setStatusNote(`UTR ${detectedUtr} submitted. Verifying with bank...`);
    } catch (err) {
      console.warn('[WaitingModal] Auto-verify error:', err?.message);
    } finally {
      setSubmittingUtr(false);
    }
  }, [submittingUtr, onSubmitManualUtr, orderId, handleTriggerSuccess]);


  // One-tap Auto-Paste & Verify handler
  const handlePasteAndVerify = useCallback(async () => {
    try {
      // 1. Try native thread clipboard extraction first (window-focus proof)
      const nativeRes = await nativeUpiService.getClipboardUtr();
      let detected = (nativeRes?.hasUtr && nativeRes?.utr) ? nativeRes.utr : null;

      // 2. Also pass raw native text through our regex if native didn't extract directly
      if (!detected && nativeRes?.text) {
        detected = extractUtrFromText(nativeRes.text);
      }

      // 3. Fallback to JS Clipboard
      if (!detected) {
        const text = await Clipboard.getString();
        detected = extractUtrFromText(text);
      }

      if (detected && isValidUtr(detected)) {
        setUtrInput(detected);
        await autoVerifyUtr(detected);
      } else {
        Alert.alert(
          'No 12-digit UTR on Clipboard',
          'Please copy your bank SMS or the 12-digit UPI Reference / UTR Number, then tap Paste again, or enter the 12 digits directly below.'
        );
      }
    } catch (e) {
      console.warn('Paste error:', e);
    }
  }, [extractUtrFromText, autoVerifyUtr]);

  // Continuous clipboard auto-polling (checks native & JS clipboard every 1.5s)
  useEffect(() => {
    if (!visible || status !== 'WAITING') return;

    const pollClipboard = async () => {
      try {
        const nativeRes = await nativeUpiService.getClipboardUtr();
        let detected = (nativeRes?.hasUtr && nativeRes?.utr) ? nativeRes.utr : null;
        if (!detected && nativeRes?.text) {
          detected = extractUtrFromText(nativeRes.text);
        }
        if (!detected) {
          const clip = await Clipboard.getString();
          detected = extractUtrFromText(clip);
        }
        if (detected && !utrInput && !submittingUtr) {
          console.log('[WaitingModal] Auto-detected UTR from clipboard:', detected);
          setUtrInput(detected);
          autoVerifyUtr(detected);
        }
      } catch (e) {}
    };

    pollClipboard();
    const interval = setInterval(pollClipboard, 1500);

    return () => clearInterval(interval);
  }, [visible, status, extractUtrFromText, autoVerifyUtr, utrInput, submittingUtr]);

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
    setStatusNote(`Submitting UTR ${clean}...`);
    try {
      if (onSubmitManualUtr) {
        const res = await onSubmitManualUtr(clean);
        if (res?.verified === true && res?.status === 'COMPLETED') {
          handleTriggerSuccess(res);
          return;
        }
      }
      if (orderId) {
        const checkRes = await walletService.checkPaymentStatus(orderId);
        if (checkRes?.data?.data?.status === 'COMPLETED' && checkRes?.data?.data?.verified === true) {
          handleTriggerSuccess(checkRes.data.data);
          return;
        }
      }
      setStatusNote(`UTR ${clean} submitted. Verifying with bank...`);
    } catch (err) {
      Alert.alert('Verification Notice', err?.message || 'Could not verify UTR. Please check the number and try again.');
    } finally {
      setSubmittingUtr(false);
    }
  };

  const styles = createStyles(theme, isDarkMode);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancelAndClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.secureBadge}>
              <ShieldCheck size={16} color="#10B981" />
              <Text style={styles.secureBadgeText}>Bank Direct UPI</Text>
            </View>
            <TouchableOpacity
              onPress={handleCancelAndClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.closeBtn}
            >
              <X size={20} color={theme.colors.textSecondary || '#6B7280'} />
            </TouchableOpacity>
          </View>

          {/* SUCCESS VIEW */}
          {status === 'SUCCESS' && (
            <View style={styles.successContainer}>
              <View style={styles.successIconCircle}>
                <CheckCircle2 size={48} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>Payment Verified! ✓</Text>
              <Text style={styles.successSub}>
                {purpose === 'wallet_topup'
                  ? `₹${amount} has been successfully added to your Kwickly Wallet.`
                  : purpose === 'subscription'
                  ? `Your ${planTitle || 'membership'} subscription is now active!`
                  : `Your order payment of ₹${amount} was received!`}
              </Text>
            </View>
          )}

          {/* WAITING OR TIMEOUT VIEW */}
          {status !== 'SUCCESS' && (
            <View style={styles.waitingContainer}>
              {/* Animated Radar Pulse */}
              <View style={styles.radarWrapper}>
                <Animated.View
                  style={[
                    styles.radarPulse,
                    { transform: [{ scale: pulseAnim }] }
                  ]}
                />
                <View style={styles.radarCenter}>
                  {status === 'WAITING' ? (
                    <ActivityIndicator size="small" color="#6C47FF" />
                  ) : (
                    <Clock size={24} color="#F59E0B" />
                  )}
                </View>
              </View>

              <Text style={styles.waitingTitle}>
                {status === 'TIMEOUT' ? 'Settlement in Progress' : 'Verifying with Bank...'}
              </Text>
              <Text style={styles.waitingSub}>
                {status === 'TIMEOUT'
                  ? 'Bank settlement usually completes in 1-2 minutes. You can enter your 12-digit UTR below to credit instantly.'
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


              {/* Always-Visible 12-Digit UTR Input Box */}
              <View style={styles.manualUtrBox}>
                <View style={styles.utrHeaderRow}>
                  <Text style={styles.utrInputLabel}>12-digit UPI Ref / UTR:</Text>
                  <TouchableOpacity
                    style={styles.inlinePasteBtn}
                    onPress={handlePasteAndVerify}
                    activeOpacity={0.7}
                  >
                    <Copy size={13} color="#6C47FF" />
                    <Text style={styles.inlinePasteText}>Paste</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.utrInputRow}>
                  <TextInput
                    style={styles.utrInput}
                    placeholder="e.g. 661308021402"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={12}
                    value={utrInput}
                    onChangeText={(text) => {
                      setUtrInput(text);
                      const clean = text.trim();
                      if (clean.length === 12 && isValidUtr(clean)) {
                        autoVerifyUtr(clean);
                      }
                    }}
                  />
                  <TouchableOpacity
                    style={[styles.submitUtrBtn, utrInput.trim().length !== 12 && styles.submitUtrBtnDisabled]}
                    disabled={utrInput.trim().length !== 12 || submittingUtr}
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

              {/* Action Buttons */}
              <View style={{ width: '100%', marginTop: 8, gap: 10 }}>
                <TouchableOpacity
                  style={styles.pasteUtrBtn}
                  onPress={handlePasteAndVerify}
                  activeOpacity={0.8}
                >
                  <Copy size={16} color="#6C47FF" />
                  <Text style={styles.pasteUtrBtnText}>
                    Auto-Paste & Verify from SMS / Clipboard
                  </Text>
                </TouchableOpacity>

                {status === 'WAITING' && (
                  <View style={styles.autoCheckingBadge}>
                    <ActivityIndicator size="small" color="#6C47FF" />
                    <Text style={styles.autoCheckingText}>
                      Auto-detecting bank receipt & settlement...
                    </Text>
                  </View>
                )}

                {status === 'TIMEOUT' && (
                  <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={handleManualUtrSubmit}
                    disabled={submittingUtr || utrInput.trim().length !== 12}
                    activeOpacity={0.85}
                  >
                    {submittingUtr ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.doneBtnText}>Verify UTR & Credit Wallet</Text>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.cancelPaymentBtn}
                  onPress={handleCancelAndClose}
                  activeOpacity={0.75}
                >
                  <Text style={styles.cancelPaymentBtnText}>
                    {status === 'TIMEOUT' ? 'Close' : "Didn't pay? Cancel"}
                  </Text>
                </TouchableOpacity>
              </View>
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
    padding: 22,
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
    marginBottom: 16,
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
    width: '100%',
  },
  radarWrapper: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  radarPulse: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(108, 71, 255, 0.15)',
  },
  radarCenter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDarkMode ? '#2D2B52' : '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text || '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  waitingSub: {
    fontSize: 12,
    color: theme.colors.textSecondary || '#6B7280',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    width: '100%',
  },
  infoPill: {
    flex: 1,
    backgroundColor: isDarkMode ? '#28273D' : '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 8,
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
  notifAccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: isDarkMode ? '#28273E' : '#EEF2FF',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 12,
    width: '100%',
  },
  notifAccessText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6C47FF',
  },
  manualUtrBox: {
    width: '100%',
    backgroundColor: isDarkMode ? '#252438' : '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? '#3E3C5E' : '#E5E7EB',
    marginBottom: 6,
  },
  utrHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  utrInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text || '#111827',
  },
  inlinePasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  inlinePasteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6C47FF',
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
    fontWeight: '700',
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
    width: 76,
    height: 76,
    borderRadius: 38,
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
    fontSize: 13,
    color: theme.colors.textSecondary || '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
  },
  pasteUtrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: isDarkMode ? '#28273E' : '#F5F3FF',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#6C47FF',
    width: '100%',
  },
  pasteUtrBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6C47FF',
  },
  autoCheckingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: isDarkMode ? '#28273E' : '#F5F3FF',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? '#4C4872' : '#DDD6FE',
  },
  autoCheckingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6C47FF',
  },
  cancelPaymentBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  cancelPaymentBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary || '#6B7280',
  },
});

export default UpiPaymentWaitingModal;
