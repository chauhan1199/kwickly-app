import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native/Libraries/Linking/Linking', () => {
  const mock = {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    removeEventListener: jest.fn(),
    getInitialURL: jest.fn(() => Promise.resolve(null)),
    openURL: jest.fn(),
    canOpenURL: jest.fn(() => Promise.resolve(true)),
  };
  return { __esModule: true, default: mock, ...mock };
});

const Linking = require('react-native/Libraries/Linking/Linking').default;

import {
  getDeepLinkPath,
  resolveDeepLinkTarget,
  savePendingDeepLink,
  consumePendingDeepLink,
  watchDeepLinksWhileLoggedOut,
} from '../src/utils/deepLink';

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('deepLink guard', () => {
  describe('getDeepLinkPath', () => {
    it('extracts the path from a custom-scheme link', () => {
      expect(getDeepLinkPath('kwickly://home')).toBe('home');
    });

    it('extracts the path from an https link', () => {
      expect(getDeepLinkPath('https://kwickly.app/worker/jobs')).toBe('worker/jobs');
    });

    it('strips query strings and leading/trailing slashes', () => {
      expect(getDeepLinkPath('https://kwickly.app/orders?tab=active/')).toBe('orders');
    });

    it('returns null for empty/invalid input', () => {
      expect(getDeepLinkPath(null)).toBeNull();
      expect(getDeepLinkPath('')).toBeNull();
      expect(getDeepLinkPath('kwickly://')).toBeNull();
    });
  });

  describe('resolveDeepLinkTarget', () => {
    it('resolves customer routes with the right role', () => {
      expect(resolveDeepLinkTarget('kwickly://home')).toEqual({
        path: 'home',
        app: 'CustomerApp',
        screen: 'Home',
        role: 'CUSTOMER',
      });
    });

    it('resolves worker and shop routes', () => {
      expect(resolveDeepLinkTarget('kwickly://worker/map').role).toBe('WORKER');
      expect(resolveDeepLinkTarget('https://kwickly.app/shop/orders').app).toBe('ShopApp');
    });

    it('returns null for unknown or param-dependent routes', () => {
      expect(resolveDeepLinkTarget('kwickly://chat/123')).toBeNull();
      expect(resolveDeepLinkTarget('kwickly://unknown')).toBeNull();
    });
  });

  describe('pending link persistence', () => {
    beforeEach(async () => {
      await AsyncStorage.clear();
    });

    it('saves a pending target while logged out and consumes it after login', async () => {
      const saved = await savePendingDeepLink('kwickly://worker/jobs');
      expect(saved).toBe(true);
      const target = await consumePendingDeepLink();
      expect(target).toMatchObject({ app: 'WorkerApp', screen: 'Jobs', role: 'WORKER' });
      // Consumed once — not replayed on next read.
      expect(await consumePendingDeepLink()).toBeNull();
    });

    it('does not save unrecognized links', async () => {
      expect(await savePendingDeepLink('kwickly://nonsense')).toBe(false);
      expect(await consumePendingDeepLink()).toBeNull();
    });
  });

  describe('watchDeepLinksWhileLoggedOut', () => {
    beforeEach(async () => {
      await AsyncStorage.clear();
      Linking.getInitialURL.mockReset?.();
    });

    it('stores an initial deep link only when logged out', async () => {
      Linking.getInitialURL.mockResolvedValueOnce('kwickly://home');
      const stop = watchDeepLinksWhileLoggedOut(() => true);
      stop();
      await flushPromises();
      const target = await consumePendingDeepLink();
      expect(target?.screen).toBe('Home');
    });

    it('ignores links when the user is logged in', async () => {
      Linking.getInitialURL.mockResolvedValueOnce('kwickly://home');
      const stop = watchDeepLinksWhileLoggedOut(() => false);
      stop();
      await flushPromises();
      expect(await consumePendingDeepLink()).toBeNull();
    });
  });
});
