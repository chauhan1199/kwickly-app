import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { SOCKET_URL } from '../config/env';

/**
 * useSocket — establishes a socket.io connection and returns helper methods.
 *
 * @param {object} options
 * @param {string}   options.role       — 'CUSTOMER' | 'WORKER' | 'SHOP'
 * @param {string}   options.userId     — current user's _id
 * @param {string}   [options.shopId]   — for SHOP role only
 * @param {function} options.onEvent    — callback(event, data)
 *
 * @returns {{ joinJobRoom, leaveJobRoom, emit, connected }}
 */
const useSocket = ({ role, userId, shopId, onEvent }) => {
  const socketRef = useRef(null);
  const onEventRef = useRef(onEvent);
  const appState = useRef(AppState.currentState);

  // Keep ref fresh without triggering reconnects
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const getOrCreate = useCallback(async () => {
    if (socketRef.current?.connected) return socketRef.current;

    const token = await AsyncStorage.getItem('userToken');

    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: { token },
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      // Join the appropriate personal room
      if (role === 'CUSTOMER' && userId) socket.emit('JOIN_CUSTOMER_ROOM', { userId });
      if (role === 'WORKER'   && userId) socket.emit('JOIN_WORKER_ROOM',   { userId });
      if (role === 'SHOP'     && shopId) socket.emit('JOIN_SHOP_ROOM',     { shopId });
    });

    // Forward all events to the consumer
    const EVENTS = [
      'NEW_QUOTE', 'QUOTE_ACCEPTED', 'JOB_TAKEN',
      'WORKER_LOCATION', 'NEW_MESSAGE',
      'START_TIMER', 'JOB_STARTED', 'JOB_COMPLETED', 'JOB_PAID',
      'NEW_ORDER', 'ORDER_STATUS',
      'DASHBOARD_UPDATE', 'NEW_NOTIFICATION',
      // P1: Previously missing events — now handled
      'FORCED_OFFLINE', 'JOB_RADIUS_EXPANDED',
      'JOB_DISPUTED', 'DISPUTE_RESOLVED',
      'JOB_STATUS_CHANGED',
    ];

    EVENTS.forEach(ev => {
      socket.on(ev, (data) => {
        onEventRef.current?.(ev, data);
      });
    });

    socket.on('disconnect', () => {
      // silently handle disconnects; socket.io auto-reconnects
    });

    socketRef.current = socket;
    return socket;
  }, [role, userId, shopId, onEventRef]);

  useEffect(() => {
    getOrCreate();
    
    // Handle AppState changes (background/foreground) to prevent Ghost Workers
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        getOrCreate();
      } else if (nextAppState.match(/inactive|background/)) {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [getOrCreate]);

  // Re-emit join events if auth state becomes available AFTER connection is already established
  useEffect(() => {
    if (socketRef.current?.connected) {
      if (role === 'CUSTOMER' && userId) socketRef.current.emit('JOIN_CUSTOMER_ROOM', { userId });
      if (role === 'WORKER'   && userId) socketRef.current.emit('JOIN_WORKER_ROOM',   { userId });
      if (role === 'SHOP'     && shopId) socketRef.current.emit('JOIN_SHOP_ROOM',     { shopId });
    }
  }, [role, userId, shopId]);

  const joinJobRoom = (jobId) => socketRef.current?.emit('JOIN_JOB_ROOM', { jobId });
  const leaveJobRoom = () => {}; // rooms are ephemeral in socket.io

  const emit = (event, data) => socketRef.current?.emit(event, data);

  return {
    joinJobRoom,
    leaveJobRoom,
    emit,
    connected: socketRef.current?.connected ?? false,
    socket: socketRef.current // Expose raw socket if manual on/off is needed
  };
};

export default useSocket;
