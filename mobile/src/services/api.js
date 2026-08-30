import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { API_BASE_URL, SERVER_BASE_URL } from '../config/env';

// Default request timeout: 25 seconds for normal JSON calls. The API is hosted
// on an instance that sleeps when idle and can take ~30s to answer the first
// request, so a short timeout would fail every cold start (see warmUpBackend).
// Image/photo uploads get a longer window (see request interceptor below).
const DEFAULT_TIMEOUT = 25000;
const UPLOAD_TIMEOUT = 60000;
const COLD_START_TIMEOUT = 60000;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT,
});

/**
 * Fire-and-forget ping that wakes a sleeping backend instance while the user is
 * still on the splash/login screen, so their first real request isn't the one
 * paying the cold-start cost. Never throws.
 */
export const warmUpBackend = () => {
  // Never fire during unit tests — mounting <App /> must not hit the network.
  if (typeof jest !== 'undefined') return;
  axios.get(`${SERVER_BASE_URL}/health`, { timeout: COLD_START_TIMEOUT }).catch(() => {});
};

const isUploadRequest = (config) => {
  if (!config) return false;
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) return true;
  const contentType = config.headers?.['Content-Type'] || config.headers?.get?.('Content-Type');
  return typeof contentType === 'string' && contentType.includes('multipart/form-data');
};

/**
 * Build a user-friendly message from any axios/network error.
 * Used so screens never surface raw axios internals to end users.
 */
export const getApiErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error) return fallback;
  if (error.friendlyMessage) return error.friendlyMessage;
  const serverMessage =
    (Array.isArray(error.response?.data?.errors) && error.response.data.errors.join(', ')) ||
    error.response?.data?.message;
  if (serverMessage) return serverMessage;
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return 'The request timed out. Please check your connection and try again.';
  }
  if (error.code === 'ERR_NETWORK' || (!error.response && error.request)) {
    return 'No internet connection. Please check your network and try again.';
  }
  return error.message || fallback;
};

// Request Interceptor: Inject JWT + extend timeout for uploads
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Large image uploads legitimately take longer than the default window.
    if (isUploadRequest(config)) {
      config.timeout = Math.max(config.timeout || 0, UPLOAD_TIMEOUT);
    }
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Response Interceptor: Error Handling
api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.status === 'error') {
      console.error('[API] Error response:', response.data);
    }
    return response;
  },
  (error) => {
    // Cold-start / flaky-transport retry, once, for reads only. A POST/PATCH is
    // never replayed — a timed-out write may still have been applied server-side
    // and retrying it could double-create a job, order or wallet entry.
    const config = error.config;
    const method = (config?.method || 'get').toLowerCase();
    if (
      config &&
      !config.__retried &&
      !error.response &&
      (method === 'get' || method === 'head')
    ) {
      config.__retried = true;
      config.timeout = COLD_START_TIMEOUT;
      return api(config);
    }

    if (error.response?.status === 401) {
      // Clear the full stored session; AuthContext listens for this event
      // and resets state, landing the user back on the auth stack.
      AsyncStorage.multiRemove(['userToken', 'userRole', 'userData']).catch(() => {});
      DeviceEventEmitter.emit('UNAUTHORIZED_ACCESS');
    }
    // Surface a friendly message for network-level failures (offline / timeout).
    if (!error.response) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        error.friendlyMessage = 'The request timed out. Please check your connection and try again.';
      } else {
        error.friendlyMessage = 'No internet connection. Please check your network and try again.';
      }
    }
    console.error('[API] Request failed:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;
