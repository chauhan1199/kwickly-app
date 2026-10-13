import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { Platform, DeviceEventEmitter, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/authService';
import { consumePendingDeepLink } from '../utils/deepLink';
import { setCrashUserContext } from '../utils/crashReporter';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userToken, setUserToken] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // Deep-link target captured while logged out, applied after sign-in.
  const [pendingDeepLink, setPendingDeepLink] = useState(null);
  const clearPendingDeepLink = useCallback(() => setPendingDeepLink(null), []);

  const fetchUser = useCallback(async (role) => {
    try {
      const res = await authService.getProfile();
      const userData = res.data.data;
      if (userData) {
        setUser(userData);
        setCrashUserContext(userData.id || userData._id || null, userData.role || role);
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
      setCrashUserContext(null, null);
      setPendingDeepLink(null);
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
            const cachedUser = JSON.parse(cachedUserStr);
            setUser(cachedUser);
            if (token) setCrashUserContext(cachedUser?.id || cachedUser?._id || null, role);
          } catch (_) {}
        }
        
        if (token) {
          // Revalidate profile in background
          fetchUser(role);
          // Re-register the device for push on cold start (the token may never
          // have reached the backend, e.g. after a reinstall). No-op without FCM.
          const { registerForPushNotifications } = require('../utils/pushNotification');
          registerForPushNotifications().catch(() => {});
        }
      } catch (e) {
        console.error('Auth Storage Load Error:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadStorageData();

    // Listen for unauthorized access events from api interceptor
    let alertShown = false;
    const subscription = DeviceEventEmitter.addListener('UNAUTHORIZED_ACCESS', () => {
      signOut();
      // Several requests can fail at once; tell the user only once why they were signed out
      if (!alertShown) {
        alertShown = true;
        Alert.alert('Session expired', 'Please sign in again to continue.', [{ text: 'OK', onPress: () => { alertShown = false; } }]);
      }
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
      // Attach user context for crash reporting / error logs.
      setCrashUserContext(userData?.id || userData?._id || null, role);
      if (userData) {
        setUser(userData);
        setCrashUserContext(userData.id || userData._id || null, userData.role || role);
        await AsyncStorage.setItem('userData', JSON.stringify(userData)).catch(() => {});
      } else {
        fetchUser(role);
      }
      // If the user arrived via a deep link while logged out, surface it for
      // post-login redirect.
      const target = await consumePendingDeepLink().catch(() => null);
      if (target && target.role === role) {
        setPendingDeepLink(target);
      }
      // Fire-and-forget: register this device for push (no-op if Firebase SDK absent)
      const { registerForPushNotifications } = require('../utils/pushNotification');
      registerForPushNotifications().catch(() => {});
    } catch (e) {
      console.error('SignIn Error:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ userToken, userRole, user, isLoading, signIn, signOut, fetchUser, pendingDeepLink, clearPendingDeepLink }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
