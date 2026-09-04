import api from './api';
import { withErrorHandling } from '../utils/apiHandler';

export const walletService = {
  getBalance: () =>
    withErrorHandling(() => api.get('/wallet/balance')),

  getWallet: () =>
    withErrorHandling(() => api.get('/wallet/balance')),

  getTransactions: (page = 1, limit = 20) =>
    withErrorHandling(() => api.get('/wallet/my-transactions', { params: { page, limit } })),

  topupWallet: (amount, paymentDetails, planId, utrNumber, upiOrderId, extra) =>
    withErrorHandling(() => api.post('/wallet/topup', {
      amount,
      paymentDetails,
      planId,
      utrNumber: utrNumber || extra,
      upiOrderId,
      razorpayPaymentId: utrNumber || extra,
      razorpayOrderId: upiOrderId
    })),

  withdraw: (amount, payoutMethod) =>
    withErrorHandling(() => api.post('/wallet/withdraw', { amount, payoutMethod })),

  requestWithdrawal: (amount, payoutMethod) =>
    withErrorHandling(() => api.post('/wallet/withdraw', { amount, payoutMethod })),

  // Alias kept for backwards compatibility
  topup: (amount, paymentDetails, planId, utrNumber, upiOrderId, extra) =>
    walletService.topupWallet(amount, paymentDetails, planId, utrNumber, upiOrderId, extra),


  createPaymentOrder: (data) =>
    withErrorHandling(() => api.post('/payments/create-order', data)),

  // Alias kept for compatibility
  createOrder: (data) =>
    withErrorHandling(() => api.post('/payments/create-order', data)),

  verifyPayment: (data) =>
    withErrorHandling(() => api.post('/payments/verify', data)),

  checkPaymentStatus: (orderId) =>
    withErrorHandling(() => api.get(`/payments/status/${orderId}`)),

  cancelPayment: (data) =>
    withErrorHandling(() => api.post('/payments/cancel', data)),

  getAdminUpiConfig: () =>
    withErrorHandling(() => api.get('/payments/admin-upi')),
};


