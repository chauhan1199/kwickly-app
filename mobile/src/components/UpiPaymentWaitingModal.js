import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ActivityIndicator, TextInput, Animated, Easing, Platform,
  KeyboardAvoidingView, Alert, Linking, AppState
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTheme } from '../context/ThemeContext';
import useSocket, { useSocket as useSocketNamed } from '../hooks/useSocket';
import { walletService } from '../services/walletService';
import { nativeUpiService } from '../services/nativeUpiService';
import { isValidUtr, parseBankSms, validateSmsPayment } from '../utils/upiValidation';
import { CheckCircle2, Clock, ShieldCheck, X, ArrowRight, Copy, MessageSquare, AlertCircle } from 'lucide-react-native';

const resolveUseSocket = useSocket || useSocketNamed;

// Track UTRs submitted in this session to prevent re-submitting or pre-filling stale numbers
const deviceUsedUtrs = new Set();

/**
 * UpiPaymentWaitingModal
 * Professional 2-stage UPI confirmation & instant verification modal:
 * - Step 1: "Did you complete the payment?"
 *   - "✕ No, Cancelled": Closes immediately, cancels order, returns to wallet with ZERO waiting!
 *   - "✓ Yes, I Paid": Transitions to UTR verification.
 * - Step 2: "Enter 12-Digit Bank UPI Ref (UTR)"
 *   - 1-tap Auto-Paste from Clipboard / SMS with strict amount validation
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
    const parsed = parseBankSms(text);
    return parsed.utr;
  }, []);

  // Submit and verify a 12-digit UTR
  const executeVerifyUtr = useCallback(async (candidateUtr, extraMeta = {}) => {
    const clean = (candidateUtr || utrInput || '').toString().trim();
    if (!clean || !isValidUtr(clean)) {
      Alert.alert(
        'Invalid UTR Number',
        'Please enter the exact 12-digit UPI Reference (UTR) Number from your bank receipt or SMS.'
      );
      return;
    }

    if (deviceUsedUtrs.has(clean)) {
      Alert.alert(
        'Already Used UTR',
        `UTR ${clean} was already submitted in this session. Please check your bank SMS for the new 12-digit reference.`
      );
      return;
    }

    deviceUsedUtrs.add(clean);
    setSubmittingUtr(true);
    setStatusNote(`Verifying UTR ${clean} with bank...`);
    try {
      if (onSubmitManualUtr) {
        const res = await onSubmitManualUtr(clean, extraMeta);
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
      deviceUsedUtrs.delete(clean);
      Alert.alert('Verification Failed', err?.response?.data?.message || err?.message || 'Could not verify UTR. Please check the number and try again.');
    } finally {
      setSubmittingUtr(false);
    }
  }, [utrInput, onSubmitManualUtr, orderId, handleTriggerSuccess, onClose]);

  // ─── Automated Bank SMS & Background Detection (Zero Manual Entry!) ───
  const scanCountRef = useRef(0);

  const checkAndVerifyCandidate = useCallback(async (candidateText, extraMeta = {}) => {
    if (!candidateText || typeof candidateText !== 'string') return false;
    const clean = candidateText.trim();
    if (!clean) return false;

    // Case 1: Validate as SMS / notification text
    const validation = validateSmsPayment({ text: clean, expectedAmount: amount });
    if (validation.isValid && !deviceUsedUtrs.has(validation.utr)) {
      console.log('[AutoUPI] Auto-detected valid UTR from message/clipboard:', validation.utr);
      setStatusNote('Payment reference detected! Verifying...');
      setUtrInput(validation.utr);
      await executeVerifyUtr(validation.utr, {
        rawMessage: validation.rawText,
        detectedAmount: validation.amount,
        dateStr: validation.dateStr,
        ...extraMeta
      });
      return true;
    }

    // Case 2: Standalone 12-digit UTR
    const raw12 = clean.replace(/\D/g, '');
    if (raw12.length === 12 && isValidUtr(raw12) && !deviceUsedUtrs.has(raw12)) {
      console.log('[AutoUPI] Auto-detected pure 12-digit UTR:', raw12);
      setStatusNote('Payment reference detected! Verifying...');
      setUtrInput(raw12);
      await executeVerifyUtr(raw12, extraMeta);
      return true;
    }

    return false;
  }, [amount, executeVerifyUtr]);

  const triggerImmediateScan = useCallback(async () => {
    if (!visible || step === 'SUCCESS' || submittingUtr) return;
    try {
      // 1. Check native bank SMS detection
      const smsRes = await nativeUpiService.getLatestSmsUtr();
      if (smsRes?.hasUtr && smsRes?.utr && isValidUtr(smsRes.utr)) {
        const smsAmt = smsRes.amount ? parseFloat(smsRes.amount) : null;
        const diff = smsAmt && amount ? Math.abs(smsAmt - Number(amount)) : 0;
        const roundedMatch = smsAmt && amount ? Math.round(smsAmt) === Math.round(Number(amount)) : true;

        if (smsAmt && amount && diff > 1.01 && !roundedMatch) {
          console.log('[AutoUPI] Ignoring SMS UTR due to amount mismatch:', smsAmt, 'expected:', amount);
        } else {
          const detected = smsRes.utr.trim();
          if (!deviceUsedUtrs.has(detected)) {
            console.log('[AutoUPI] Auto-detected UTR from bank SMS:', detected);
            setStatusNote('Bank SMS detected! Verifying payment...');
            setUtrInput(detected);
            await executeVerifyUtr(detected, { rawMessage: smsRes.body || '', detectedAmount: smsAmt });
            return;
          }
        }
      }

      // 2. Check native clipboard
      const nativeClip = await nativeUpiService.getClipboardUtr();
      let clipText = nativeClip?.text || '';

      // 3. Check React Native Clipboard directly as fallback
      if (!clipText) {
        try {
          clipText = await Clipboard.getString();
        } catch (e) {}
      }

      if (clipText) {
        const handled = await checkAndVerifyCandidate(clipText);
        if (handled) return;
      }

      // 4. Poll backend order status
      if (orderId) {
        const statusRes = await walletService.checkPaymentStatus(orderId);
        if (statusRes?.data?.data?.status === 'COMPLETED') {
          handleTriggerSuccess(statusRes.data.data);
          return;
        }
      }
    } catch (err) {
      console.warn('[AutoUPI] Instant scan error:', err?.message);
    }
  }, [visible, step, submittingUtr, amount, orderId, executeVerifyUtr, checkAndVerifyCandidate, handleTriggerSuccess]);

  // Restart auto-scanning immediately whenever app returns to foreground (user finishes in GPay / SMS)
  useEffect(() => {
    if (!visible || step === 'SUCCESS') return;

    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('[AutoUPI] App became active! Triggering instant auto-scan...');
        scanCountRef.current = 0;
        setTimeout(() => {
          triggerImmediateScan();
        }, 500);
      }
    });

    return () => sub.remove();
  }, [visible, step, triggerImmediateScan]);

  // Periodic background auto-scanner
  useEffect(() => {
    if (!visible || step === 'SUCCESS' || submittingUtr) return;

    let isMounted = true;
    scanCountRef.current = 0;
    const maxScans = 25;

    const performAutoScan = async () => {
      if (!isMounted || step === 'SUCCESS') return;
      scanCountRef.current++;

      await triggerImmediateScan();

      if (isMounted && scanCountRef.current < maxScans && step !== 'SUCCESS') {
        timer = setTimeout(performAutoScan, 2000);
      }
    };

    let timer = setTimeout(performAutoScan, 800);

    const unsubscribeSms = nativeUpiService.subscribeToBankSms(async (event) => {
      if (event?.utr && isValidUtr(event.utr) && !deviceUsedUtrs.has(event.utr.trim())) {
        const eventAmt = event.amount ? parseFloat(event.amount) : null;
        const diff = eventAmt && amount ? Math.abs(eventAmt - Number(amount)) : 0;
        const roundedMatch = eventAmt && amount ? Math.round(eventAmt) === Math.round(Number(amount)) : true;
        if (eventAmt && amount && diff > 1.01 && !roundedMatch) {
          console.log('[AutoUPI] Real-time SMS ignored due to amount mismatch:', eventAmt, 'expected:', amount);
          return;
        }
        console.log('[AutoUPI] Real-time SMS broadcast received:', event.utr);
        setStatusNote('Bank SMS received! Verifying...');
        setUtrInput(event.utr.trim());
        await executeVerifyUtr(event.utr.trim(), { rawMessage: event.body || '', detectedAmount: eventAmt });
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (unsubscribeSms) unsubscribeSms();
    };
  }, [visible, step, submittingUtr, triggerImmediateScan, amount, executeVerifyUtr]);

  const handleUserConfirmedPaid = useCallback(async () => {
    setStatusNote('Detecting bank confirmation...');
    try {
      // 1. Check SMS inbox
      const smsRes = await nativeUpiService.getLatestSmsUtr();
      if (smsRes?.hasUtr && smsRes?.utr && isValidUtr(smsRes.utr)) {
        const smsAmt = smsRes.amount ? parseFloat(smsRes.amount) : null;
        const diff = smsAmt && amount ? Math.abs(smsAmt - Number(amount)) : 0;
        const roundedMatch = smsAmt && amount ? Math.round(smsAmt) === Math.round(Number(amount)) : true;
        if (!smsAmt || !amount || diff <= 1.01 || roundedMatch) {
          if (!deviceUsedUtrs.has(smsRes.utr.trim())) {
            setUtrInput(smsRes.utr.trim());
            await executeVerifyUtr(smsRes.utr.trim(), { rawMessage: smsRes.body || '', detectedAmount: smsAmt });
            return;
          }
        }
      }

      // 2. Check Clipboard (native or JS)
      let clip = '';
      const nativeClip = await nativeUpiService.getClipboardUtr();
      if (nativeClip?.text) clip = nativeClip.text;
      if (!clip) clip = await Clipboard.getString();
      if (clip) {
        const handled = await checkAndVerifyCandidate(clip);
        if (handled) return;
      }
    } catch (e) {
      console.warn('[AutoUPI] handleUserConfirmedPaid check error:', e);
    }
    setStep('ENTER_UTR');
  }, [amount, executeVerifyUtr, checkAndVerifyCandidate]);

  // One-tap Auto-Paste & Verify handler
  const handlePasteAndVerify = useCallback(async () => {
    try {
      // 1. Get raw text from native clipboard or JS clipboard
      let rawText = '';
      const nativeRes = await nativeUpiService.getClipboardUtr();
      if (nativeRes?.text) {
        rawText = nativeRes.text;
      }
      if (!rawText) {
        rawText = await Clipboard.getString();
      }

      if (!rawText || !rawText.trim()) {
        Alert.alert(
          'Clipboard Empty',
          'Please open your bank SMS app or payment notification, copy the message or 12-digit UTR, and tap Auto-Paste again.'
        );
        return;
      }

      const clean = rawText.trim();

      // Case A: Full Bank SMS (length > 15 characters)
      if (clean.length > 15) {
        const validation = validateSmsPayment({ text: clean, expectedAmount: amount });
        if (validation.isValid) {
          const detected = validation.utr;
          if (deviceUsedUtrs.has(detected)) {
            Alert.alert(
              'Already Used UTR',
              `UTR ${detected} was already submitted in this session. Please check your bank SMS for the new 12-digit reference.`
            );
            return;
          }

          setUtrInput(detected);
          await executeVerifyUtr(detected, {
            rawMessage: validation.rawText,
            detectedAmount: validation.amount,
            dateStr: validation.dateStr
          });
          return;
        }
      }

      // Case B: User copied just the 12-digit UTR number
      const utrCandidate = clean.replace(/\D/g, '');
      if (utrCandidate.length === 12 && isValidUtr(utrCandidate)) {
        if (deviceUsedUtrs.has(utrCandidate)) {
          Alert.alert(
            'Already Used UTR',
            `UTR ${utrCandidate} was already submitted in this session.`
          );
          return;
        }

        setUtrInput(utrCandidate);
        await executeVerifyUtr(utrCandidate);
        return;
      }

      Alert.alert(
        'No Valid UTR Found',
        'Could not find a valid 12-digit UPI Reference (UTR) or Bank SMS in your clipboard. Please check your bank SMS and copy the reference number.'
      );
    } catch (e) {
      console.warn('Paste error:', e);
    }
  }, [amount, executeVerifyUtr]);

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

  // User explicitly cancels by saying "No, I Cancelled / Didn't Pay" in Step 1
  const handleExplicitCancel = async () => {
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

  // Simply dismisses modal without cancelling the order (e.g. user minimizing to check bank SMS)
  const handleDismissModal = () => {
    if (onClose) onClose();
  };

  const styles = createStyles(theme, isDarkMode);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismissModal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
              onPress={handleDismissModal}
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
                  onPress={handleUserConfirmedPaid}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>✓ Yes, I Completed Payment</Text>
                </TouchableOpacity>

                {/* NO, CANCELLED PAYMENT BUTTON - ZERO DELAY, CLOSES IMMEDIATELY */}
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={handleExplicitCancel}
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
                  <Text style={styles.utrInputLabel}>12-digit UPI Ref / Bank SMS:</Text>
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
                    placeholder="e.g. 661513309006 or paste SMS"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="default"
                    maxLength={250}
                    value={utrInput}
                    onChangeText={(text) => {
                      const clean = text.trim();
                      if (clean.length > 12) {
                        // User pasted full SMS message into the input field
                        const validation = validateSmsPayment({ text: clean, expectedAmount: amount });
                        if (!validation.isValid) {
                          Alert.alert('Payment Validation Warning', validation.error || 'Invalid payment message.');
                          setUtrInput('');
                          return;
                        }
                        setUtrInput(validation.utr);
                        executeVerifyUtr(validation.utr, {
                          rawMessage: validation.rawText,
                          detectedAmount: validation.amount,
                          dateStr: validation.dateStr
                        });
                        return;
                      }
                      setUtrInput(clean);
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
                    Auto-Paste UTR / Bank SMS
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
                  onPress={handleDismissModal}
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
    maxHeight: '90%',
    backgroundColor: isDarkMode ? '#1E1E2E' : '#FFFFFF',
    borderRadius: 24,
    padding: 20,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: isDarkMode ? '#2D2B52' : '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
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
