import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { SOCKET_URL } from '../config/env';

/**
 * Set by WorkerNavigateJobScreen while the worker is heading to a job. The worker
 * usually switches to Google Maps, so the socket must not drop when the app goes to
 * the background; on foreground / reconnect the last location is sent again.
 * NOTE: this only keeps the socket open; JS timers and GPS callbacks may still be
 * throttled by Android in the background. True background tracking needs a
 * foreground service, which is not implemented.
 */
export const activeJobTracking = { active: false, lastLocation: null };

const resendLastLocation = (socket) => {
  const last = activeJobTracking.lastLocation;
  if (activeJobTracking.active && last && socket?.connected) {
    socket.emit('WORKER_LOCATION_UPDATE', last);
  }
};

/**
 * useSocket — establishes a socket.io connection and returns helper methods.
 *
 * @param {object} [options={}]
 * @param {string}   [options.role]       — 'CUSTOMER' | 'WORKER' | 'SHOP'
 * @param {string}   [options.userId]     — current user's _id
 * @param {string}   [options.shopId]     — for SHOP role only
 * @param {function} [options.onEvent]    — callback(event, data)
 *
 * @returns {{ joinJobRoom, leaveJobRoom, emit, connected, socket }}
 */
const useSocket = (options = {}) => {
  const { role, userId, shopId, onEvent } = options || {};
  const socketRef = useRef(null);
  const [socketInstance, setSocketInstance] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  const appState = useRef(AppState.currentState);

  // Keep ref fresh without triggering reconnects
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const getOrCreate = useCallback(async () => {
    if (socketRef.current?.connected) {
      setSocketInstance(socketRef.current);
      setIsConnected(true);
      return socketRef.current;
    }

    // A socket kept alive in the background may still be reconnecting: replace it, don't leak it
    socketRef.current?.disconnect();

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
      setIsConnected(true);
      setSocketInstance(socket);
      resendLastLocation(socket);
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
      setIsConnected(false);
    });

    socketRef.current = socket;
    setSocketInstance(socket);
    setIsConnected(socket.connected);
    return socket;
  }, [role, userId, shopId, onEventRef]);

  useEffect(() => {
    getOrCreate();
    
    // Handle AppState changes (background/foreground) to prevent Ghost Workers
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        getOrCreate().then(resendLastLocation).catch(() => {});
      } else if (nextAppState.match(/inactive|background/)) {
        // Keep the socket while a worker is navigating to an active job (see activeJobTracking)
        if (socketRef.current && !activeJobTracking.active) {
          socketRef.current.disconnect();
          socketRef.current = null;
          setSocketInstance(null);
          setIsConnected(false);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocketInstance(null);
      setIsConnected(false);
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
    connected: isConnected,
    socket: socketInstance || socketRef.current // Expose reactive socket instance
  };
};

export { useSocket };
export default useSocket;
