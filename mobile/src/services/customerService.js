import api from './api';

export const customerService = {
  getProfile: () =>
    api.get('/customers/me/profile'),

  updateProfilePhoto: (formData) =>
    api.put('/customers/me/profile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  updateProfile: (data) =>
    api.put('/customers/me/profile', data),

  deleteAccount: (password) =>
    api.delete('/customers/me/account', { data: { password } }),

  getTopPros: () =>
    api.get('/customers/top-pros'),

  getActiveJob: () =>
    api.get('/customers/jobs/active'),

  getJobReceipt: (jobId) =>
    api.get(`/customers/jobs/${jobId}/receipt`),

  getWorkerProfile: (workerId) =>
    api.get(`/customers/workers/${workerId}/profile`),

  updateNotificationPreferences: (prefs) =>
    api.put('/customers/me/notifications', prefs),

  openDispute: (data) =>
    api.post('/customers/disputes', data),

  addAddress: (data) =>
    api.post('/customers/me/addresses', data),

  updateAddress: (id, data) =>
    api.put(`/customers/me/addresses/${id}`, data),

  deleteAddress: (id) =>
    api.delete(`/customers/me/addresses/${id}`),

  setPrimaryAddress: (id) =>
    api.patch(`/customers/me/addresses/${id}/primary`),
};
