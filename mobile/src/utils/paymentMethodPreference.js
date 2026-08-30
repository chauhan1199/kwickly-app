/**
 * Local persistence of the user's preferred default payment method
 * ('upi' | 'bank'). The methods themselves come from the user's wallet on
 * the backend; this only remembers which one the user marked as default.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_METHOD_KEY = '@kwickly_default_payment_method';
export const VALID_METHOD_IDS = ['upi', 'bank'];

export const getDefaultPaymentMethod = async () => {
  try {
    const value = await AsyncStorage.getItem(DEFAULT_METHOD_KEY);
    return VALID_METHOD_IDS.includes(value) ? value : null;
  } catch (_) {
    return null;
  }
};

export const setDefaultPaymentMethod = async (id) => {
  if (!VALID_METHOD_IDS.includes(id)) {
    throw new Error(`Invalid payment method id: ${id}`);
  }
  await AsyncStorage.setItem(DEFAULT_METHOD_KEY, id);
  return id;
};

export const clearDefaultPaymentMethod = async () => {
  await AsyncStorage.removeItem(DEFAULT_METHOD_KEY);
};
