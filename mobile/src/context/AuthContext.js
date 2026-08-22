import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { Platform, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userToken, setUserToken] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async (role) => {
    try {
      const res = await authService.getProfile();
      const userData = res.data.data;
      if (userData) {
        setUser(userData);
        await AsyncStorage.setItem('userData', JSON.stringify(userData)).catch(() => {});
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  }, []);

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userRole');
      await AsyncStorage.removeItem('userData');
      setUserToken(null);
      setUserRole(null);
      setUser(null);
    } catch (e) {
      console.error('SignOut Error:', e);
    }
  };

  useEffect(() => {
    const loadStorageData = async () => {
      try {
        const [token, role, cachedUserStr] = await Promise.all([
          AsyncStorage.getItem('userToken'),
          AsyncStorage.getItem('userRole'),
          AsyncStorage.getItem('userData'),
        ]);

        if (token) setUserToken(token);
        if (role) setUserRole(role);
        if (cachedUserStr) {
          try {
            setUser(JSON.parse(cachedUserStr));
          } catch (_) {}
        }
        
        if (token) {
          // Revalidate profile in background
          fetchUser(role);
        }
      } catch (e) {
        console.error('Auth Storage Load Error:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadStorageData();

    // Listen for unauthorized access events from api interceptor
    const subscription = DeviceEventEmitter.addListener('UNAUTHORIZED_ACCESS', () => {
      signOut();
    });

    return () => {
      subscription.remove();
    };
  }, [fetchUser]);

  const signIn = async (token, role, userData = null) => {
    try {
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userRole', role);
      setUserToken(token);
      setUserRole(role);
      if (userData) {
        setUser(userData);
        await AsyncStorage.setItem('userData', JSON.stringify(userData)).catch(() => {});
      } else {
        fetchUser(role);
      }
      // Fire-and-forget: register this device for push (no-op if Firebase SDK absent)
      const { registerForPushNotifications } = require('../utils/pushNotification');
      registerForPushNotifications().catch(() => {});
    } catch (e) {
      console.error('SignIn Error:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ userToken, userRole, user, isLoading, signIn, signOut, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
