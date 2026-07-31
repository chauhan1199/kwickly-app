import api from './api';
import { withErrorHandling } from '../utils/apiHandler';

export const customerService = {
  getProfile: () =>
    withErrorHandling(() => api.get('/customers/me/profile')),

  updateProfilePhoto: async (formData) => {
    try {
      const response = await api.put('/customers/me/profile', formData);
      return response.data;
    } catch (error) {
      console.error('[Customer] Update photo failed:', error);
      throw error;
    }
  },

  updateProfile: (data) =>
    withErrorHandling(() => api.put('/customers/me/profile', data)),

  deleteAccount: (password) =>
    withErrorHandling(() => api.delete('/customers/me/account', { data: { password } })),

  getTopPros: () =>
    withErrorHandling(() => api.get('/customers/top-pros')),

  getActiveJob: () =>
    withErrorHandling(() => api.get('/customers/jobs/active')),

  getJobReceipt: (jobId) =>
    withErrorHandling(() => api.get(`/customers/jobs/${jobId}/receipt`)),

  getWorkerProfile: (workerId) =>
    withErrorHandling(() => api.get(`/customers/workers/${workerId}/profile`)),

  updateNotificationPreferences: (prefs) =>
    withErrorHandling(() => api.put('/customers/me/notifications', prefs)),

  triggerNotification: (data) =>
    withErrorHandling(() => api.post('/customers/me/notifications/trigger', data)),

  openDispute: (data) =>
    withErrorHandling(() => api.post('/customers/disputes', data)),

  addAddress: (data) =>
    withErrorHandling(() => api.post('/customers/me/addresses', data)),

  updateAddress: (id, data) =>
    withErrorHandling(() => api.put(`/customers/me/addresses/${id}`, data)),

  deleteAddress: (id) =>
    withErrorHandling(() => api.delete(`/customers/me/addresses/${id}`)),

  setPrimaryAddress: (id) =>
    withErrorHandling(() => api.patch(`/customers/me/addresses/${id}/primary`)),
};
