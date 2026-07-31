import api from './api';
import { withErrorHandling, handleResponse } from '../utils/apiHandler';

export const authService = {
  sendOtp: (phone, role) =>
    withErrorHandling(() => api.post('/auth/send-otp', { phone, role })),

  verifyOtp: (phone, otp, role) =>
    withErrorHandling(() => api.post('/auth/verify-otp', { phone, code: otp, role })),

  checkStatus: (phone, role) =>
    withErrorHandling(() => api.post('/auth/check-status', { phone, role })),

  login: (phone, password, role) =>
    withErrorHandling(() => api.post('/auth/login', { phone, password, role })),

  setPassword: async (password, token) => {
    try {
      const response = await api.patch('/auth/set-password', { password }, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      return handleResponse(response);
    } catch (error) {
      console.error('[Auth] Set password failed:', error);
      throw error;
    }
  },

  getProfile: () =>
    withErrorHandling(() => api.get('/auth/me')),

  logout: () =>
    withErrorHandling(() => api.post('/auth/logout')),

  forgotPassword: (phone, role) =>
    withErrorHandling(() => api.post('/auth/forgot-password', { phone, role })),

  resetPassword: async (phone, code, newPassword, role) => {
    try {
      const response = await api.post('/auth/reset-password', { phone, code, newPassword, role });
      return handleResponse(response);
    } catch (error) {
      console.error('[Auth] Reset password failed:', error);
      throw error;
    }
  },
};

export default authService;
