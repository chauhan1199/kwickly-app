import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ActivityIndicator, TextInput, Animated, Easing, Platform,
  KeyboardAvoidingView, Alert, Linking
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTheme } from '../context/ThemeContext';
import useSocket, { useSocket as useSocketNamed } from '../hooks/useSocket';
import { walletService } from '../services/walletService';
import { nativeUpiService } from '../services/nativeUpiService';
import { isValidUtr } from '../utils/upiValidation';
import { CheckCircle2, Clock, ShieldCheck, X, ArrowRight, Copy, MessageSquare, AlertCircle } from 'lucide-react-native';

const resolveUseSocket = useSocket || useSocketNamed;

/**
 * UpiPaymentWaitingModal
 * Professional 2-stage UPI confirmation & instant verification modal:
 * - Step 1: "Did you complete the payment?"
 *   - "✕ No, Cancelled": Closes immediately, cancels order, returns to wallet with ZERO waiting!
 *   - "✓ Yes, I Paid": Transitions to UTR verification.
 * - Step 2: "Enter 12-Digit Bank UPI Ref (UTR)"
 *   - 1-tap Auto-Paste from Clipboard / SMS
 *   - Direct 12-digit number keyboard
 *   - 1-tap "Open Messages App" button to view bank SMS
 *   - Instant verification & wallet balance credit
 * - Step 3: "Payment Verified! ✓" celebration
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
  initialStep = 'CONFIRM_PAID', // 'CONFIRM_PAID' | 'ENTER_UTR'
  onSubmitManualUtr
}) => {
  const { theme, isDarkMode } = useTheme();

  const [step, setStep] = useState(initialStep); // 'CONFIRM_PAID' | 'ENTER_UTR' | 'SUCCESS'
  const [utrInput, setUtrInput] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [statusNote, setStatusNote] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Reset state whenever modal opens
  useEffect(() => {
    if (!visible) return;
    setStep(initialStep || 'CONFIRM_PAID');
    setUtrInput('');
    setSubmittingUtr(false);
    setStatusNote('');

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [visible, initialStep]);

  const handleTriggerSuccess = useCallback((data) => {
    setStep('SUCCESS');
    if (onSuccess) {
      try { onSuccess(data); } catch (e) { console.warn(e); }
    }
    setTimeout(() => {
      if (onClose) onClose();
    }, 1500);
  }, [onSuccess, onClose]);

  // Real-time WebSocket listener
  const handleSocketEvent = useCallback((event, payload) => {
    if (!visible || step === 'SUCCESS') return;

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
  }, [visible, step, amount, purpose, handleTriggerSuccess]);

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

  // Submit and verify a 12-digit UTR
  const executeVerifyUtr = useCallback(async (candidateUtr) => {
    const clean = (candidateUtr || utrInput || '').toString().trim();
    if (!clean || !isValidUtr(clean)) {
      Alert.alert(
        'Invalid UTR Number',
        'Please enter the exact 12-digit UPI Reference (UTR) Number from your bank receipt or SMS.'
      );
      return;
    }

    setSubmittingUtr(true);
    setStatusNote(`Verifying UTR ${clean} with bank...`);
    try {
      if (onSubmitManualUtr) {
        const res = await onSubmitManualUtr(clean);
        const isSuccess = res?.verified === true || res?.status === 'COMPLETED' || res?.data?.status === 'COMPLETED' || res?.data?.verified === true;
        if (isSuccess) {
          handleTriggerSuccess(res?.data || res);
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
      Alert.alert(
        'Verification In Progress',
        `UTR ${clean} submitted. Your wallet will update once bank confirmation is received.`
      );
      if (onClose) onClose();
    } catch (err) {
      Alert.alert('Verification Notice', err?.message || 'Could not verify UTR. Please check the number and try again.');
    } finally {
      setSubmittingUtr(false);
    }
  }, [utrInput, onSubmitManualUtr, orderId, handleTriggerSuccess, onClose]);

  // One-tap Auto-Paste & Verify handler
  const handlePasteAndVerify = useCallback(async () => {
    try {
      // 1. Native clipboard
      const nativeRes = await nativeUpiService.getClipboardUtr();
      let detected = (nativeRes?.hasUtr && nativeRes?.utr) ? nativeRes.utr : null;

      if (!detected && nativeRes?.text) {
        detected = extractUtrFromText(nativeRes.text);
      }

      // 2. JS Clipboard fallback
      if (!detected) {
        const text = await Clipboard.getString();
        detected = extractUtrFromText(text);
      }

      if (detected && isValidUtr(detected)) {
        setUtrInput(detected);
        await executeVerifyUtr(detected);
      } else {
        Alert.alert(
          'No 12-digit UTR on Clipboard',
          'Please open your bank SMS or notification, copy the message or the 12-digit UPI Reference / UTR Number, then tap Paste again, or enter the 12 digits directly.'
        );
      }
    } catch (e) {
      console.warn('Paste error:', e);
    }
  }, [extractUtrFromText, executeVerifyUtr]);

  // Launch default SMS app so user can copy UTR
  const handleOpenSmsApp = async () => {
    try {
      const url = Platform.OS === 'android' ? 'sms:' : 'sms:';
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
      } else {
        Alert.alert('SMS App', 'Please open your Messages app from your home screen and copy the 12-digit UPI Ref.');
      }
    } catch (e) {
      Alert.alert('SMS App', 'Please open your Messages app from your home screen and copy the 12-digit UPI Ref.');
    }
  };

  // Continuous clipboard auto-polling while on ENTER_UTR step
  useEffect(() => {
    if (!visible || step !== 'ENTER_UTR') return;

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
        }
      } catch (e) {}
    };

    pollClipboard();
    const interval = setInterval(pollClipboard, 1500);

    return () => clearInterval(interval);
  }, [visible, step, extractUtrFromText, utrInput, submittingUtr]);

  // User explicitly cancels or says "No, Cancelled"
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
          {/* Card Top Header */}
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

          {/* STEP 1: DID YOU COMPLETE PAYMENT PROMPT */}
          {step === 'CONFIRM_PAID' && (
            <View style={styles.confirmContainer}>
              <View style={styles.promptIconCircle}>
                <AlertCircle size={40} color="#6C47FF" />
              </View>

              <Text style={styles.promptTitle}>Payment Status</Text>
              <Text style={styles.promptSub}>
                Did you complete the <Text style={{ fontWeight: '800', color: theme.colors.text }}>₹{amount}</Text> payment in your UPI app?
              </Text>

              <View style={styles.amountPill}>
                <View>
                  <Text style={styles.amountPillLabel}>Top-up Amount</Text>
                  <Text style={styles.amountPillValue}>₹{amount}</Text>
                </View>
                {payeeName ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amountPillLabel}>Recipient</Text>
                    <Text style={styles.payeeNameSmall} numberOfLines={1}>{payeeName}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.actionColumn}>
                {/* YES, COMPLETED PAYMENT BUTTON */}
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => setStep('ENTER_UTR')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>✓ Yes, I Completed Payment</Text>
                </TouchableOpacity>

                {/* NO, CANCELLED PAYMENT BUTTON - ZERO DELAY, CLOSES IMMEDIATELY */}
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={handleCancelAndClose}
                  activeOpacity={0.85}
                >
                  <Text style={styles.cancelBtnText}>✕ No, I Cancelled / Didn't Pay</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 2: ENTER UTR NUMBER */}
          {step === 'ENTER_UTR' && (
            <View style={styles.enterUtrContainer}>
              <Text style={styles.stepTitle}>Confirm UPI Reference</Text>
              <Text style={styles.stepSub}>
                Enter the 12-digit UPI Reference (UTR) from your bank SMS to credit <Text style={{ fontWeight: '800', color: '#10B981' }}>₹{amount}</Text> to your wallet.
              </Text>

              {/* UTR INPUT BOX */}
              <View style={styles.manualUtrBox}>
                <View style={styles.utrHeaderRow}>
                  <Text style={styles.utrInputLabel}>12-digit Bank UPI Ref / UTR:</Text>
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
                    placeholder="e.g. 661406151223"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={12}
                    value={utrInput}
                    onChangeText={(text) => {
                      setUtrInput(text);
                      const clean = text.trim();
                      if (clean.length === 12 && isValidUtr(clean)) {
                        executeVerifyUtr(clean);
                      }
                    }}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[styles.submitUtrBtn, utrInput.trim().length !== 12 && styles.submitUtrBtnDisabled]}
                    disabled={utrInput.trim().length !== 12 || submittingUtr}
                    onPress={() => executeVerifyUtr(utrInput)}
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

              {/* ACTION BUTTONS ROW */}
              <View style={styles.actionColumn}>
                <TouchableOpacity
                  style={styles.pasteUtrBtn}
                  onPress={handlePasteAndVerify}
                  activeOpacity={0.8}
                >
                  <Copy size={16} color="#6C47FF" />
                  <Text style={styles.pasteUtrBtnText}>
                    Auto-Paste from SMS / Clipboard
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.openSmsBtn}
                  onPress={handleOpenSmsApp}
                  activeOpacity={0.8}
                >
                  <MessageSquare size={16} color="#4B5563" />
                  <Text style={styles.openSmsBtnText}>
                    Open Messages / SMS App to Copy
                  </Text>
                </TouchableOpacity>

                {/* PRIMARY VERIFY & CREDIT BUTTON */}
                <TouchableOpacity
                  style={[styles.primaryBtn, (utrInput.trim().length !== 12 || submittingUtr) && styles.disabledBtn]}
                  onPress={() => executeVerifyUtr(utrInput)}
                  disabled={utrInput.trim().length !== 12 || submittingUtr}
                  activeOpacity={0.85}
                >
                  {submittingUtr ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Verify & Credit ₹{amount} to Wallet →</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelPaymentBtn}
                  onPress={handleCancelAndClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelPaymentBtnText}>Cancel / Close</Text>
                </TouchableOpacity>
              </View>

              {/* HELPFUL BANK FORMAT NOTE */}
              <View style={styles.tipBox}>
                <Text style={styles.tipText}>
                  💡 <Text style={{ fontWeight: '700' }}>Tip:</Text> Check your bank SMS (Kotak, SBI, CRED, HDFC) for <Text style={{ fontWeight: '700' }}>"UPI Ref: 661406151223"</Text> or <Text style={{ fontWeight: '700' }}>"Ref No"</Text>.
                </Text>
              </View>
            </View>
          )}

          {/* STEP 3: SUCCESS CELEBRATION */}
          {step === 'SUCCESS' && (
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
  confirmContainer: {
    alignItems: 'center',
    width: '100%',
  },
  promptIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: isDarkMode ? '#2D2B52' : '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  promptTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: theme.colors.text || '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  promptSub: {
    fontSize: 13.5,
    color: theme.colors.textSecondary || '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  amountPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#28273D' : '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    width: '100%',
    marginBottom: 16,
  },
  amountPillLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary || '#6B7280',
    fontWeight: '600',
  },
  amountPillValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#10B981',
  },
  payeeNameSmall: {
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.colors.text || '#111827',
    maxWidth: 160,
  },
  actionColumn: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: '#6C47FF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  cancelBtn: {
    backgroundColor: isDarkMode ? '#28273D' : '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: isDarkMode ? '#3E3C5E' : '#E5E7EB',
  },
  cancelBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: theme.colors.textSecondary || '#6B7280',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  enterUtrContainer: {
    width: '100%',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text || '#111827',
    marginBottom: 4,
  },
  stepSub: {
    fontSize: 12.5,
    color: theme.colors.textSecondary || '#6B7280',
    lineHeight: 18,
    marginBottom: 14,
  },
  manualUtrBox: {
    width: '100%',
    backgroundColor: isDarkMode ? '#252438' : '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#6C47FF',
    marginBottom: 12,
  },
  utrHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  utrInputLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#6C47FF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inlinePasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  inlinePasteText: {
    fontSize: 11.5,
    fontWeight: '800',
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
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text || '#111827',
    letterSpacing: 1.2,
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
  openSmsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: isDarkMode ? '#28273D' : '#F9FAFB',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? '#3E3C5E' : '#E5E7EB',
    width: '100%',
  },
  openSmsBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.colors.textSecondary || '#4B5563',
  },
  cancelPaymentBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  cancelPaymentBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.colors.textSecondary || '#6B7280',
  },
  tipBox: {
    backgroundColor: isDarkMode ? '#28273E' : '#EEF2FF',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  tipText: {
    fontSize: 11.5,
    color: isDarkMode ? '#C7D2FE' : '#4338CA',
    lineHeight: 16,
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
});

export default UpiPaymentWaitingModal;
