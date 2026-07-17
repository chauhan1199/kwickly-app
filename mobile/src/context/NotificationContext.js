import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { AppState, Alert } from 'react-native';
import notificationService from '../services/notificationService';
import { useAuth } from './AuthContext';
import useSocket from '../hooks/useSocket';

const NotificationContext = createContext({ unreadCount: 0, refreshUnread: () => {} });

export const NotificationProvider = ({ children }) => {
  const { userToken, userRole, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const refreshUnread = useCallback(async () => {
    if (!userToken) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await notificationService.getUnreadCount();
      if (res.data?.status === 'success') {
        setUnreadCount(res.data.data.unreadCount || 0);
      }
    } catch {
      // silently ignore (e.g. no auth)
    }
  }, [userToken]);

  useSocket({
    role: userRole,
    userId: user?._id,
    onEvent: (event, data) => {
      if (event === 'NEW_NOTIFICATION') {
        setUnreadCount(prev => prev + 1);
        Alert.alert(
          data.title || 'New Notification', 
          data.message || 'You have a new notification.'
        );
      }
    }
  });

  // Poll every 5 minutes when app is active
  useEffect(() => {
    if (!userToken) {
      setUnreadCount(0);
      return;
    }

    refreshUnread(); // immediate fetch

    intervalRef.current = setInterval(refreshUnread, 300000);

    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        refreshUnread(); // refetch when app comes foreground
      }
      appStateRef.current = nextState;
    });

    return () => {
      clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [userToken, refreshUnread]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnread }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
