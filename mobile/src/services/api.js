import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Standard Android Emulator IP to reach localhost
const BASE_URL = 'http://10.0.2.2:5000/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
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
  (error) => Promise.reject(error)
);

// Response Interceptor: Error Handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token on auth failure
      AsyncStorage.removeItem('userToken');
    }
    return Promise.reject(error);
  }
);

export default api;
