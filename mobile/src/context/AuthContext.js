import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/authService';
import { io } from 'socket.io-client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userToken, setUserToken] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  const initSocket = useCallback((userData, role) => {
    if (!userData?._id) return;
    
    const socketUrl = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
    const newSocket = io(socketUrl);
    
    newSocket.on('connect', () => {
      console.log('Global socket connected:', newSocket.id);
      
      // Join user-specific room to receive notifications
      const room = role === 'WORKER' ? `worker_${userData._id}` : `customer_${userData._id}`;
      newSocket.emit('JOIN_ROOM', room);
    });

    setSocket(newSocket);
  }, []);

  const fetchUser = useCallback(async (role) => {
    try {
      const res = await authService.getProfile();
      const userData = res.data.data;
      setUser(userData);
      initSocket(userData, role);
    } catch (error) {
      console.log('Failed to fetch user profile:', error);
    }
  }, [initSocket]);

  useEffect(() => {
    const loadStorageData = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const role = await AsyncStorage.getItem('userRole');
        setUserToken(token);
        setUserRole(role);
        
        // Fetch user profile if token exists
        if (token) {
          try {
            const res = await authService.getProfile();
            const userData = res.data.data;
            setUser(userData);
            initSocket(userData, role);
          } catch (e) {
            console.log('Error fetching initial profile', e);
          }
        }
      } catch (e) {
        console.error('Auth Storage Load Error:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadStorageData();

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const signIn = async (token, role, userData = null) => {
    try {
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userRole', role);
      setUserToken(token);
      setUserRole(role);
      if (userData) {
        setUser(userData);
        initSocket(userData, role);
      } else {
        fetchUser(role);
      }
    } catch (e) {
      console.error('SignIn Error:', e);
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userRole');
      setUserToken(null);
      setUserRole(null);
      setUser(null);
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    } catch (e) {
      console.error('SignOut Error:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ userToken, userRole, user, socket, isLoading, signIn, signOut, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
