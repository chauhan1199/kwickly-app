import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { SOCKET_URL } from '../config/env';

/**
 * useSocket — establishes a socket.io connection and returns helper methods.
 *
 * @param {object} [options={}]
 * @param {string}   [options.role]       — 'CUSTOMER' | 'WORKER' | 'SHOP'
 * @param {string}   [options.userId]     — current user's _id
 * @param {string}   [options.shopId]     — for SHOP role only
 * @param {function} [options.onEvent]    — callback(event, data)
 *
 * @returns {{ joinJobRoom, leaveJobRoom, emit, connected }}
 */
const useSocket = (options = {}) => {
  const { role, userId, shopId, onEvent } = options || {};
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
      // Try websocket first, but fall back to long-polling: some mobile carriers
      // and corporate proxies block websocket upgrades outright, and losing the
      // socket means losing every live job/order update.
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 30000,
    });

    socket.on('connect', () => {
      // Role rooms (customer_/worker_/shop_/user_) are joined server-side on
      // connection from the JWT in `auth.token` — nothing to request here.
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
      'WALLET_UPDATE', 'WALLET_TOPUP_APPROVED', 'SUBSCRIPTION_ACTIVATED'
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

  // Nothing to re-emit on auth state change — rooms are joined server-side
  // from the JWT handshake, and reconnection re-runs that handshake.
  useEffect(() => { }, [role, userId, shopId]);

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

export { useSocket };
export default useSocket;
