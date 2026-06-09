import api from './api';

export const workerService = {
  /** Get subscription plans */
  getPlans: () =>
    api.get('/subscriptions/plans'),

  /** Worker: subscribe to a plan */
  subscribe: (planId, paymentId) =>
    api.post('/subscriptions/subscribe', { planId, paymentId }),

  /** Worker: get own subscription history */
  getMySubscriptions: () =>
    api.get('/subscriptions/my'),

  /** Worker: update online status (via profile update) */
  setOnlineStatus: (isOnline) =>
    api.patch('/auth/me', { isOnline }),

  /** Worker: get their profile + kyc status */
  getWorkerProfile: () =>
    api.get('/auth/me'),

  /** Update profile fields (name, online status) */
  updateProfile: (data) =>
    api.patch('/workers/me/profile', data),

  /** Update profile photo via multipart/form-data */
  updateProfilePhoto: (formData) =>
    api.patch('/workers/me/profile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /** Worker: get services (categories) */
  getMyServices: () =>
    api.get('/auth/me/services'),

  /** Worker: update services */
  updateServices: (services) =>
    api.patch('/workers/me/services', { services }),

  /** Worker: update active location and radius */
  updateLocation: (data) =>
    api.patch('/workers/me/location', data),

  /** Worker: upload KYC documents */
  updateKyc: (formData) =>
    api.patch('/workers/me/kyc', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /** Worker: update bank details */
  updateBank: (data) =>
    api.patch('/workers/me/bank', data),

  /** Worker: submit category suggestion */
  submitCategorySuggestion: (data) =>
    api.post('/workers/me/category-suggestions', data),

  /** Worker: add a new address */
  addAddress: (data) =>
    api.post('/workers/me/addresses', data),

  /** Worker: update an address */
  updateAddress: (addressId, data) =>
    api.put(`/workers/me/addresses/${addressId}`, data),

  /** Worker: delete an address */
  deleteAddress: (addressId) =>
    api.delete(`/workers/me/addresses/${addressId}`),

  /** Worker: set an address as primary */
  setPrimaryAddress: (addressId) =>
    api.patch(`/workers/me/addresses/${addressId}/primary`),
};
