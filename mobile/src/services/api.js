import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { API_BASE_URL } from '../config/env';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds to allow large image uploads
});

// Request Interceptor: Inject JWT
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
    if (error.response?.status === 401) {
      AsyncStorage.removeItem('userToken');
      DeviceEventEmitter.emit('UNAUTHORIZED_ACCESS');
    }
    console.error('[API] Request failed:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;
