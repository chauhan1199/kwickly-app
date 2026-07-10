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

  /** Admin: get all platform transactions */
  getAllTransactions: (params) =>
    api.get('/wallet/transactions', { params }),

  /** Admin: manual credit/debit adjustment */
  adminAdjust: (userId, amount, description, debit = false) =>
    api.post('/wallet/adjust', { userId, amount, description, debit }),
};
