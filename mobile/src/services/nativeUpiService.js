import { NativeModules, Platform, Linking } from 'react-native';

const { NativeUpiPayment } = NativeModules;

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
   * Safe no-op kept for backward compatibility with older callers
   */
  async clearSmsCache() {
    return true;
  }
};
