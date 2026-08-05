import api from './api';
import { withErrorHandling } from '../utils/apiHandler';

export const walletService = {
  getBalance: () =>
    withErrorHandling(() => api.get('/wallet/balance')),

  withdraw: (amount, payoutMethod) =>
    withErrorHandling(() => api.post('/wallet/withdraw', { amount, payoutMethod })),

  topup: async (amount, paymentDetails, planId, razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
    try {
      const response = await api.post('/wallet/topup', {
        amount,
        paymentDetails,
        planId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      });
      return response.data;
    } catch (error) {
      console.error('[Wallet] Topup failed:', error);
      throw error;
    }
  },

  createPaymentOrder: (data) =>
    withErrorHandling(() => api.post('/payments/create-order', data)),

  // Alias kept for compatibility
  createOrder: (data) =>
    withErrorHandling(() => api.post('/payments/create-order', data)),

  verifyPayment: (data) =>
    withErrorHandling(() => api.post('/payments/verify', data)),
};
