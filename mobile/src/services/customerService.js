import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://10.0.2.2:5000/api/v1';

export const customerService = {
  getProfile: () =>
    api.get('/customers/me/profile'),

  updateProfilePhoto: async (formData) => {
    const token = await AsyncStorage.getItem('userToken');
    const response = await fetch(`${BASE_URL}/customers/me/profile`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: formData,
    });
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: 'Network Error or Server Error' };
      }
      throw { response: { data: errorData } };
    }
    return response.json();
  },

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

  triggerNotification: (data) =>
    api.post('/customers/me/notifications/trigger', data),

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
