import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import notificationService from '../services/notificationService';
import { useAuth } from './AuthContext';

const NotificationContext = createContext({ unreadCount: 0, refreshUnread: () => {} });

export const NotificationProvider = ({ children }) => {
  const { userToken } = useAuth();
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

  // Poll every 30 seconds when app is active
  useEffect(() => {
    if (!userToken) {
      setUnreadCount(0);
      return;
    }

    refreshUnread(); // immediate fetch

    intervalRef.current = setInterval(refreshUnread, 30000);

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
