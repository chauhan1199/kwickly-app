import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useNetwork } from '../hooks/useNetwork';
import { WifiOff } from 'lucide-react-native';
import Theme from '../constants/Theme';

const OfflineBanner = () => {
  const { isOffline } = useNetwork();

  if (!isOffline) return null;

  return (
    <View style={styles.container}>
      <WifiOff size={16} color="#fff" style={styles.icon} />
      <Text style={styles.text}>No Internet Connection</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.error || '#ef4444',
    padding: Platform.OS === 'ios' ? 12 : 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  icon: {
    marginRight: 4,
  }
});

export default OfflineBanner;
