import api from './api';

export const walletService = {
  /** Get wallet balance and recent transactions */
  getWallet: () =>
    api.get('/wallet/balance'),

  /** Request a withdrawal */
  requestWithdrawal: (amount, payoutMethod) =>
    api.post('/wallet/withdraw', { amount, payoutMethod }),

  /** Top up wallet */
  topupWallet: (amount, paymentDetails, planId, razorpayOrderId, razorpayPaymentId, razorpaySignature) =>
    api.post('/wallet/topup', { amount, paymentDetails, planId, razorpayOrderId, razorpayPaymentId, razorpaySignature }),

  /** Create a Razorpay payment order */
  createPaymentOrder: (data) =>
    api.post('/payments/create-order', data),

  /** Verify a Razorpay payment */
  verifyPayment: (data) =>
    api.post('/payments/verify', data),
};
