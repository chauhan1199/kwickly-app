/**
 * Deep-link guard.
 *
 * Unauthenticated deep links must land on the Auth stack (which the root
 * navigator already guarantees, since authenticated screens are only
 * registered when a token exists). This module preserves the deep-link
 * target across login so the user can be routed to it afterwards.
 *
 * Mirrors the `linking` config in src/app/navigation/RootNavigator.js —
 * keep the two in sync.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

export const PENDING_DEEP_LINK_KEY = 'pendingDeepLink';

// path -> { app, screen, role } (role must match the logged-in user's role)
export const DEEP_LINK_ROUTES = {
  'home': { app: 'CustomerApp', screen: 'Home', role: 'CUSTOMER' },
  'orders': { app: 'CustomerApp', screen: 'Orders', role: 'CUSTOMER' },
  'profile': { app: 'CustomerApp', screen: 'Profile', role: 'CUSTOMER' },
  'worker/map': { app: 'WorkerApp', screen: 'Map', role: 'WORKER' },
  'worker/jobs': { app: 'WorkerApp', screen: 'Jobs', role: 'WORKER' },
  'shop/dashboard': { app: 'ShopApp', screen: 'Dashboard', role: 'SHOP' },
  'shop/orders': { app: 'ShopApp', screen: 'Orders', role: 'SHOP' },
};

/**
 * Extract the route path from a deep-link URL.
 * 'kwickly://home' -> 'home'; 'https://kwickly.app/worker/jobs' -> 'worker/jobs'
 */
export const getDeepLinkPath = (url) => {
  if (!url || typeof url !== 'string') return null;
  let rest = url;
  const schemeSep = url.indexOf('://');
  if (schemeSep !== -1) {
    rest = url.slice(schemeSep + 3);
    // Strip host for https links (kwickly.app/home -> home). Custom-scheme
    // links (kwickly://home) have no host, so keep the path as-is.
    if (/^https?:\/\//i.test(url)) {
      const slash = rest.indexOf('/');
      rest = slash !== -1 ? rest.slice(slash + 1) : '';
    }
  }
  return rest.split('?')[0].replace(/^\/+|\/+$/g, '').toLowerCase() || null;
};

/**
 * Resolve a URL to a navigable target, or null if it is not a recognized
 * authenticated route (chat/:id needs a runtime id and is not preserved).
 */
export const resolveDeepLinkTarget = (url) => {
  const path = getDeepLinkPath(url);
  if (!path) return null;
  const route = DEEP_LINK_ROUTES[path];
  if (!route) return null;
  return { path, ...route };
};

export const savePendingDeepLink = async (url) => {
  const target = resolveDeepLinkTarget(url);
  if (!target) return false;
  await AsyncStorage.setItem(PENDING_DEEP_LINK_KEY, JSON.stringify(target));
  return true;
};

export const consumePendingDeepLink = async () => {
  let raw = null;
  try {
    raw = await AsyncStorage.getItem(PENDING_DEEP_LINK_KEY);
  } catch (_) {
    return null;
  }
  if (!raw) return null;
  try {
    await AsyncStorage.removeItem(PENDING_DEEP_LINK_KEY);
  } catch (_) {}
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
};

/**
 * Subscribe to deep-link URLs while the app is running. When the user is
 * unauthenticated, the link is stashed for post-login redirect; returns
 * the unsubscribe function.
 */
export const watchDeepLinksWhileLoggedOut = (isLoggedOut) => {
  const handle = (url) => {
    if (url && isLoggedOut()) {
      savePendingDeepLink(url).catch(() => {});
    }
  };
  Linking.getInitialURL().then(handle).catch(() => {});
  const sub = Linking.addEventListener('url', (e) => handle(e?.url));
  return () => sub && sub.remove && sub.remove();
};
