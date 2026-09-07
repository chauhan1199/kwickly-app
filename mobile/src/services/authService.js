import api from './api';
import { withErrorHandling, handleResponse } from '../utils/apiHandler';

export const authService = {
  sendOtp: (phone, role, method = 'SMS') =>
    withErrorHandling(() => api.post('/auth/send-otp', { phone, role, method })),

  verifyOtp: (phone, otp, role, name) =>
    withErrorHandling(() => api.post('/auth/verify-otp', { phone, code: otp, role, name })),

  checkStatus: (phone, role) =>
    withErrorHandling(() => api.post('/auth/check-status', { phone, ...(role ? { role } : {}) })),

  login: (phone, passwordOrMpin, role) =>
    withErrorHandling(() => api.post('/auth/login', { 
      phone, 
      password: passwordOrMpin,
      mpin: passwordOrMpin, 
      ...(role ? { role } : {})
    })),

  setMpin: async (mpin, token) => {
    try {
      const response = await api.post('/auth/set-mpin', { mpin }, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      return handleResponse(response);
    } catch (error) {
      console.error('[Auth] Set MPIN failed:', error);
      throw error;
    }
  },

  setPassword: async (password, token) => {
    try {
      const response = await api.post('/auth/set-password', { password, mpin: password }, {
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

  forgotMpin: (phone, role) =>
    withErrorHandling(() => api.post('/auth/forgot-mpin', { phone, role })),

  forgotPassword: (phone, role) =>
    withErrorHandling(() => api.post('/auth/forgot-password', { phone, role })),

  resetMpin: async (phone, code, newMpin, role) => {
    try {
      const response = await api.post('/auth/reset-mpin', { phone, code, newMpin, role });
      return handleResponse(response);
    } catch (error) {
      console.error('[Auth] Reset MPIN failed:', error);
      throw error;
    }
  },

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
