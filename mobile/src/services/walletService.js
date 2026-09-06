import api from './api';
import { withErrorHandling } from '../utils/apiHandler';

export const walletService = {
  getBalance: () =>
    withErrorHandling(() => api.get('/wallet/balance')),

  getWallet: () =>
    withErrorHandling(() => api.get('/wallet/balance')),

  getTransactions: (page = 1, limit = 20) =>
    withErrorHandling(() => api.get('/wallet/my-transactions', { params: { page, limit } })),

  topupWallet: (amount, paymentDetails, planId, utrNumber, upiOrderId, extra) => {
    const extraObj = typeof extra === 'object' && extra !== null ? extra : {};
    const finalUtr = utrNumber || extraObj.utrNumber || (typeof extra === 'string' ? extra : undefined);
    return withErrorHandling(() => api.post('/wallet/topup', {
      amount,
      paymentDetails,
      planId,
      utrNumber: finalUtr,
      upiOrderId,
      razorpayPaymentId: finalUtr,
      razorpayOrderId: upiOrderId,
      rawMessage: extraObj.rawMessage,
      smsText: extraObj.rawMessage,
      detectedAmount: extraObj.detectedAmount,
      isIntentVerified: Boolean(extraObj.isIntentVerified),
      intentStatus: extraObj.intentStatus,
      responseCode: extraObj.responseCode,
      rawResponse: extraObj.rawResponse,
      txnId: extraObj.txnId
    }));
  },

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

  lookupRecipient: (phone) =>
    withErrorHandling(() => api.post('/wallet/lookup-recipient', { phone })),

  transferWallet: ({ recipientPhone, amount, note }) =>
    withErrorHandling(() => api.post('/wallet/transfer', { recipientPhone, amount, note })),
};


