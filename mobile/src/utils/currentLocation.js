import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

const getPosition = (options) => new Promise((resolve, reject) => {
  Geolocation.getCurrentPosition(
    (position) => resolve([position.coords.longitude, position.coords.latitude]),
    (error) => reject(error),
    options
  );
});

/**
 * The device's current [longitude, latitude].
 * A satellite fix often times out indoors, so after a short GPS attempt this falls
 * back to the phone's network location (Wi-Fi / cell), which answers in a second or two.
 */
export const getCurrentCoordinates = async () => {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('Location permission is needed to confirm you have reached the customer.');
    }
  }
  try {
    return await getPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  } catch (gpsError) {
    try {
      return await getPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 });
    } catch (networkError) {
      throw new Error("Couldn't get your location. Turn on Location in your phone settings and try again.");
    }
  }
};
