import { NativeModules, Platform, Linking, NativeEventEmitter } from 'react-native';

const { NativeUpiPayment } = NativeModules;
const upiEventEmitter = NativeUpiPayment ? new NativeEventEmitter(NativeUpiPayment) : null;

export const UPI_APP_PACKAGES = {
  gpay: 'com.google.android.apps.nbu.paisa.user',
  phonepe: 'com.phonepe.app',
  paytm: 'net.one97.paytm',
  bhim: 'in.org.npci.upiapp',
  cred: 'com.dreamplug.androidapp',
  generic: null,
};

export const nativeUpiService = {
  /**
   * Starts a native UPI Payment intent using Android startActivityForResult
   * Automatically captures the official NPCI response (Status, ApprovalRefNo/UTR, txnId)
   */
  async startUpiPayment({ vpa, name, amount, txnRef, note, appKey = 'gpay' }) {
    const appPackage = UPI_APP_PACKAGES[appKey] || null;

    if (Platform.OS === 'android' && NativeUpiPayment) {
      try {
        const result = await NativeUpiPayment.startPayment({
          vpa: vpa || '',
          name: name || 'Kwickly Admin',
          amount: String(amount || '0'),
          txnRef: txnRef || `KWIK_${Date.now()}`,
          note: note || 'Kwickly Topup',
          appPackage,
        });
        return result;
      } catch (err) {
        // Fallback to Linking if native module encounters any issue
        console.warn('[NativeUPI] Falling back to Linking:', err?.message);
        const upiUrl = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(name || 'Kwickly')}&am=${amount}&cu=INR&tn=${encodeURIComponent(note || 'Kwickly')}&tr=${encodeURIComponent(txnRef || `KWIK_${Date.now()}`)}`;
        const can = await Linking.canOpenURL(upiUrl);
        if (can) {
          await Linking.openURL(upiUrl);
          return { isFallback: true, status: 'OPENED' };
        }
        throw new Error(err?.message || 'Failed to open UPI app');
      }
    } else {
      // iOS / Fallback
      const upiUrl = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(name || 'Kwickly')}&am=${amount}&cu=INR&tn=${encodeURIComponent(note || 'Kwickly')}&tr=${encodeURIComponent(txnRef || `KWIK_${Date.now()}`)}`;
      const can = await Linking.canOpenURL(upiUrl);
      if (can) {
        await Linking.openURL(upiUrl);
        return { isFallback: true, status: 'OPENED' };
      }
      throw new Error('No UPI application found on this device');
    }
  },

  /**
   * Retrieve the latest cached bank SMS UTR and amount from SmsReceiver
   */
  async getLatestSmsUtr() {
    if (Platform.OS === 'android' && NativeUpiPayment?.getLatestSmsUtr) {
      try {
        return await NativeUpiPayment.getLatestSmsUtr();
      } catch (err) {
        console.warn('[NativeUPI] getLatestSmsUtr error:', err.message);
        return { hasUtr: false, utr: '' };
      }
    }
    return { hasUtr: false, utr: '' };
  },

  /**
   * Clears cached SMS UTR
   */
  async clearSmsCache() {
    if (Platform.OS === 'android' && NativeUpiPayment?.clearSmsCache) {
      try {
        return await NativeUpiPayment.clearSmsCache();
      } catch (err) {}
    }
    return true;
  },

  /**
   * Subscribe to real-time bank SMS arrival event
   */
  subscribeToBankSms(callback) {
    if (!upiEventEmitter) return () => {};
    try {
      const subscription = upiEventEmitter.addListener('onBankSmsReceived', callback);
      return () => {
        subscription.remove();
      };
    } catch (err) {
      console.warn('[NativeUPI] subscribeToBankSms error:', err.message);
      return () => {};
    }
  },

  /**
   * Native window-focus aware clipboard reader with automatic 12-digit UTR extraction
   */
  async getClipboardUtr() {
    if (Platform.OS === 'android' && NativeUpiPayment?.getClipboardUtr) {
      try {
        return await NativeUpiPayment.getClipboardUtr();
      } catch (err) {
        console.warn('[NativeUPI] getClipboardUtr error:', err.message);
      }
    }
    return { hasUtr: false, utr: '', text: '' };
  },

  /**
   * Check if Kwickly notification listener service is enabled by user
   */
  async isNotificationListenerEnabled() {
    if (Platform.OS === 'android' && NativeUpiPayment?.isNotificationListenerEnabled) {
      try {
        return await NativeUpiPayment.isNotificationListenerEnabled();
      } catch (err) {
        return false;
      }
    }
    return false;
  },

  /**
   * Open Android system settings to enable notification access for Kwickly
   */
  async openNotificationListenerSettings() {
    if (Platform.OS === 'android' && NativeUpiPayment?.openNotificationListenerSettings) {
      try {
        return await NativeUpiPayment.openNotificationListenerSettings();
      } catch (err) {
        return false;
      }
    }
    return false;
  }
};
