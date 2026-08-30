import api from './api';
import { withErrorHandling } from '../utils/apiHandler';

export const workerService = {
  getPlans: () =>
    withErrorHandling(() => api.get('/subscriptions/plans')),

  // paymentMethod 'UPI' → PENDING_VERIFICATION (admin verifies UTR); 'WALLET' → instant activation
  subscribe: ({ planId, paymentMethod = 'UPI', utrNumber, paymentId, targetRole = 'WORKER' } = {}) =>
    withErrorHandling(() => api.post('/subscriptions/subscribe', {
      planId,
      paymentMethod,
      utrNumber,
      paymentId,
      targetRole
    })),

  getMySubscriptions: () =>
    withErrorHandling(() => api.get('/subscriptions/my')),

  setOnlineStatus: (isOnline) =>
    withErrorHandling(() => api.patch('/workers/me/online', { isOnline })),

  getProfile: () =>
    withErrorHandling(() => api.get('/workers/me')),

  updateProfile: (data) =>
    withErrorHandling(() => api.patch('/workers/me/profile', data)),

  updateProfilePhoto: (data) =>
    withErrorHandling(() => api.patch('/workers/me/profile', data)),

  updateFullProfile: (data) =>
    withErrorHandling(() => api.put('/workers/me/profile', data)),

  getMyServices: () =>
    withErrorHandling(() => api.get('/workers/me')),

  updateServices: (services) =>
    withErrorHandling(() => api.patch('/workers/me/services', { services })),

  updateLocation: (data) =>
    withErrorHandling(() => api.patch('/workers/me/location', data)),

  updateKyc: (data) =>
    withErrorHandling(() => api.patch('/workers/me/kyc', data)),

  removeKycDocument: (docIndex) =>
    withErrorHandling(() => api.delete(`/workers/me/kyc/${docIndex}`)),

  updateBank: (data) =>
    withErrorHandling(() => api.patch('/workers/me/bank', data)),

  submitCategorySuggestion: (data) =>
    withErrorHandling(() => api.post('/workers/category-suggestions', data)),

  getMySuggestions: () =>
    withErrorHandling(() => api.get('/workers/category-suggestions')),

  addAddress: (data) =>
    withErrorHandling(() => api.post('/workers/me/addresses', data)),

  updateAddress: (addressId, data) =>
    withErrorHandling(() => api.put(`/workers/me/addresses/${addressId}`, data)),

  deleteAddress: (addressId) =>
    withErrorHandling(() => api.delete(`/workers/me/addresses/${addressId}`)),

  setPrimaryAddress: (addressId) =>
    withErrorHandling(() => api.patch(`/workers/me/addresses/${addressId}/primary`)),

  getEarningsSummary: () =>
    withErrorHandling(() => api.get('/workers/earnings/summary')),

  getEarningsChart: (period = 'week') =>
    withErrorHandling(() => api.get('/workers/earnings/chart', { params: { period } })),

  getStats: () =>
    withErrorHandling(() => api.get('/workers/me/stats')),

  getEarningsTransactions: (page = 1, limit = 20) =>
    withErrorHandling(() => api.get('/workers/earnings/transactions', { params: { page, limit } })),

  requestEarningsWithdrawal: (amount, payoutMethod) =>
    withErrorHandling(() => api.post('/workers/earnings/withdraw', { amount, payoutMethod })),
};
