/**
 * Push notification registration helper.
 *
 * The mobile app does not yet ship the Firebase native SDK (`@react-native-firebase/messaging`),
 * which requires the project owner's `google-services.json`. This helper uses a lazy dynamic
 * require so the app keeps building without that SDK; when the SDK is added, tokens are
 * registered with the backend so server-side FCM push delivery works.
 */
import { notificationService } from '../services/notificationService';

let cachedToken = null;

const loadMessaging = () => {
  try {
    // eslint-disable-next-line global-require
    return require('@react-native-firebase/messaging').default;
  } catch (e) {
    return null;
  }
};

const registerToken = async (token) => {
  if (!token || token === cachedToken) return;
  cachedToken = token;
  try {
    await notificationService.registerPushToken(token);
  } catch (e) {
    console.warn('[Push] Token registration failed:', e.message);
  }
};

/**
 * Register this device's push token with the backend.
 * No-op if the Firebase messaging SDK is not installed or permission is denied.
 */
export const registerForPushNotifications = async () => {
  try {
    const messaging = loadMessaging();
    if (!messaging) return;

    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) return;

    const token = await messaging().getToken();
    await registerToken(token);
  } catch (e) {
    console.warn('[Push] Setup skipped:', e.message);
  }
};
