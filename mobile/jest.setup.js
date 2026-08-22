import 'react-native-gesture-handler/jestSetup';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

jest.mock('@react-native-community/geolocation', () => {
  return {
    getCurrentPosition: jest.fn(),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
    stopObserving: jest.fn(),
    requestAuthorization: jest.fn(),
  };
});

jest.mock('react-native-maps', () => {
  const React = require('react');
  const MapView = (props) => React.createElement('MapView', props, props.children);
  const Marker = (props) => React.createElement('Marker', props, props.children);
  return {
    __esModule: true,
    default: MapView,
    Marker: Marker,
  };
});

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
  getString: jest.fn(() => Promise.resolve('')),
  hasString: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

jest.mock('react-native-razorpay', () => ({
  open: jest.fn(() => Promise.resolve({})),
}));

