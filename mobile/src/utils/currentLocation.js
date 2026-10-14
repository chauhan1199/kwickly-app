import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

// A network (Wi-Fi / cell) fix older than this is treated as stale.
const MAX_FIX_AGE_MS = 10000;

const toPosition = (position) => ({
  coordinates: [position.coords.longitude, position.coords.latitude],
  accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
});

const getPosition = (options) => new Promise((resolve, reject) => {
  Geolocation.getCurrentPosition(
    (position) => resolve(toPosition(position)),
    (error) => reject(error),
    options
  );
});

const offerSettings = (message) => {
  Alert.alert('Location permission needed', message, [
    { text: 'Not now', style: 'cancel' },
    { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
  ]);
};

/**
 * Asks for FINE and COARSE location together (Android 12+ lets the user pick "approximate").
 * Resolves to 'fine' or 'coarse'. Rejects when nothing usable was granted; with
 * `precise: true` an approximate-only grant is rejected too. When the user chose
 * "Don't ask again" an alert offers to open the app settings (pass `offerSettings: false`
 * for automatic, not user-initiated, attempts).
 */
export const requestLocationPermission = async ({
  precise = false,
  reason = 'Location permission is needed to use your current location.',
  offerSettings: shouldOfferSettings = true,
} = {}) => {
  if (Platform.OS !== 'android') return 'fine';
  const { ACCESS_FINE_LOCATION: FINE, ACCESS_COARSE_LOCATION: COARSE } = PermissionsAndroid.PERMISSIONS;
  const { GRANTED, NEVER_ASK_AGAIN } = PermissionsAndroid.RESULTS;
  const results = await PermissionsAndroid.requestMultiple([FINE, COARSE]);
  if (results[FINE] === GRANTED) return 'fine';
  if (results[COARSE] === GRANTED && !precise) return 'coarse';

  const preciseReason = results[COARSE] === GRANTED
    ? `${reason} Please allow "Precise" location for Kwickly.`
    : reason;
  if (shouldOfferSettings && (results[FINE] === NEVER_ASK_AGAIN || results[COARSE] === NEVER_ASK_AGAIN)) {
    offerSettings(preciseReason);
  }
  throw new Error(preciseReason);
};

/**
 * The device's current position: { coordinates: [longitude, latitude], accuracy (metres or null) }.
 * A satellite fix often times out indoors, so after a short GPS attempt this falls
 * back to the phone's network location (Wi-Fi / cell), which answers in a second or two.
 * `precise: true` (the default) requires the user's "precise location" grant.
 */
export const getCurrentPosition = async ({ precise = true, reason, offerSettings = true } = {}) => {
  const level = await requestLocationPermission({
    precise,
    offerSettings,
    reason: reason || (precise
      ? 'Location permission is needed to confirm you have reached the customer.'
      : undefined),
  });
  try {
    if (level !== 'fine') throw new Error('approximate only');
    return await getPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: MAX_FIX_AGE_MS });
  } catch (gpsError) {
    try {
      return await getPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: MAX_FIX_AGE_MS });
    } catch (networkError) {
      throw new Error("Couldn't get your location. Turn on Location in your phone settings and try again.");
    }
  }
};

/** The device's current [longitude, latitude]. See getCurrentPosition for options. */
export const getCurrentCoordinates = async (options) => (await getCurrentPosition(options)).coordinates;

/**
 * Streams position updates to onPosition({ coordinates, accuracy }) until the returned
 * stop() is called. Uses GPS (25 m / ~5 s); if GPS errors (indoors, no fix) it switches to
 * network location. Permission must already be granted (see requestLocationPermission).
 */
export const watchCurrentPosition = (onPosition, onError) => {
  let watchId = null;
  let usingNetwork = false;
  const start = (highAccuracy) => Geolocation.watchPosition(
    (position) => onPosition(toPosition(position)),
    (error) => {
      if (!usingNetwork) {
        usingNetwork = true;
        if (watchId !== null) Geolocation.clearWatch(watchId);
        watchId = start(false);
        return;
      }
      onError?.(error);
    },
    {
      enableHighAccuracy: highAccuracy,
      distanceFilter: 25,
      interval: 5000,
      fastestInterval: 3000,
      timeout: highAccuracy ? 20000 : 30000,
      maximumAge: MAX_FIX_AGE_MS,
    }
  );
  watchId = start(true);
  return () => {
    if (watchId !== null) Geolocation.clearWatch(watchId);
    watchId = null;
  };
};
