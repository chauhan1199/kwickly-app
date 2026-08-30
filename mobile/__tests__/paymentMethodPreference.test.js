import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_METHOD_KEY,
  getDefaultPaymentMethod,
  setDefaultPaymentMethod,
  clearDefaultPaymentMethod,
} from '../src/utils/paymentMethodPreference';

describe('paymentMethodPreference (default payment method persistence)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('persists the default method id under the real storage key', async () => {
    await setDefaultPaymentMethod('bank');
    expect(await AsyncStorage.getItem(DEFAULT_METHOD_KEY)).toBe('bank');
  });

  it('round-trips the saved default', async () => {
    await setDefaultPaymentMethod('upi');
    expect(await getDefaultPaymentMethod()).toBe('upi');
  });

  it('returns null when nothing was saved', async () => {
    expect(await getDefaultPaymentMethod()).toBeNull();
  });

  it('ignores corrupted stored values', async () => {
    await AsyncStorage.setItem(DEFAULT_METHOD_KEY, 'not-json{{');
    expect(await getDefaultPaymentMethod()).toBeNull();
  });

  it('rejects invalid method ids instead of persisting garbage', async () => {
    await expect(setDefaultPaymentMethod('creditcard')).rejects.toThrow('Invalid payment method id');
    expect(await AsyncStorage.getItem(DEFAULT_METHOD_KEY)).toBeNull();
  });

  it('clears the persisted preference', async () => {
    await setDefaultPaymentMethod('upi');
    await clearDefaultPaymentMethod();
    expect(await getDefaultPaymentMethod()).toBeNull();
    expect(await AsyncStorage.getItem(DEFAULT_METHOD_KEY)).toBeNull();
  });
});
