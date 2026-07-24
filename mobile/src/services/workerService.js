import api from './api';

export const workerService = {
  getPlans: () =>
    api.get('/subscriptions/plans'),

  subscribe: (planId, paymentId) =>
    api.post('/subscriptions/subscribe', { planId, paymentId }),

  getMySubscriptions: () =>
    api.get('/subscriptions/my'),

  setOnlineStatus: (isOnline) =>
    api.patch('/workers/me/online', { isOnline }),

  getProfile: () =>
    api.get('/workers/me'),

  updateProfile: (data) =>
    api.patch('/workers/me/profile', data),

  updateProfilePhoto: (data) =>
    api.patch('/workers/me/profile', data),

  updateFullProfile: (data) =>
    api.put('/workers/me/profile', data),

  getMyServices: () =>
    api.get('/workers/me'),

  updateServices: (services) =>
    api.patch('/workers/me/services', { services }),

  updateLocation: (data) =>
    api.patch('/workers/me/location', data),

  updateKyc: (data) =>
    api.patch('/workers/me/kyc', data),

  removeKycDocument: (docIndex) =>
    api.delete(`/workers/me/kyc/${docIndex}`),

  updateBank: (data) =>
    api.patch('/workers/me/bank', data),

  submitCategorySuggestion: (data) =>
    api.post('/workers/category-suggestions', data),

  getMySuggestions: () =>
    api.get('/workers/category-suggestions'),

  addAddress: (data) =>
    api.post('/workers/me/addresses', data),

  updateAddress: (addressId, data) =>
    api.put(`/workers/me/addresses/${addressId}`, data),

  deleteAddress: (addressId) =>
    api.delete(`/workers/me/addresses/${addressId}`),

  setPrimaryAddress: (addressId) =>
    api.patch(`/workers/me/addresses/${addressId}/primary`),

  getEarningsSummary: () =>
    api.get('/workers/earnings/summary'),

  getEarningsChart: (period = 'week') =>
    api.get('/workers/earnings/chart', { params: { period } }),

  getStats: () =>
    api.get('/workers/me/stats'),

  getEarningsTransactions: (page = 1, limit = 20) =>
    api.get('/workers/earnings/transactions', { params: { page, limit } }),

  requestEarningsWithdrawal: (amount, payoutMethod) =>
    api.post('/workers/earnings/withdraw', { amount, payoutMethod }),
};
