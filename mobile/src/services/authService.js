import api from './api';

export const authService = {
  sendOtp: (phone, role) =>
    api.post('/auth/send-otp', { phone, role }),

  verifyOtp: (phone, otp, role) =>
    api.post('/auth/verify-otp', { phone, code: otp, role }),

  checkStatus: (phone, role) =>
    api.post('/auth/check-status', { phone, role }),

  login: (phone, password, role) =>
    api.post('/auth/login', { phone, password, role }),

  setPassword: (password, token) =>
    api.patch('/auth/set-password', { password }, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    }),

  getProfile: () =>
    api.get('/auth/me'),

  logout: () =>
    api.post('/auth/logout'),

  forgotPassword: (phone, role) =>
    api.post('/auth/forgot-password', { phone, role }),

  resetPassword: (phone, code, newPassword, role) =>
    api.post('/auth/reset-password', { phone, code, newPassword, role }),
};

export default authService;
