import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export const useNetwork = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
      setIsInternetReachable(state.isInternetReachable ?? true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    isConnected,
    isInternetReachable,
    isOffline: !isConnected || isInternetReachable === false,
  };
};
