import api from './api';

export const authService = {
  /** Send OTP to phone number */
  sendOtp: (phone) =>
    api.post('/auth/send-otp', { phone }),

  /** Verify OTP and get JWT */
  verifyOtp: (phone, otp) =>
    api.post('/auth/verify-otp', { phone, otp }),

  /** Register new user with role */
  register: (data) =>
    api.post('/auth/register', data),

  /** Login with phone + password */
  login: (phone, password) =>
    api.post('/auth/login', { phone, password }),

  /** Get current user profile */
  getProfile: () =>
    api.get('/auth/me'),

  /** Update current user profile */
  updateProfile: (data) =>
    api.patch('/auth/me', data),
};
