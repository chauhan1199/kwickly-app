import { Platform, PermissionsAndroid } from 'react-native';
import { API_BASE_URL } from '../config/env';

export const getImageUrl = (url) => {
  if (!url) return null;

  if (typeof url !== 'string') return null;

  // Already a full URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const serverUrl = API_BASE_URL.replace('/api/v1', '');

  // Relative path starting with /
  if (url.startsWith('/')) {
    return `${serverUrl}${url}`;
  }

  // Relative path without leading / (e.g., "uploads/foo.webp")
  return `${serverUrl}/${url}`;
};

export const requestCameraPermission = async () => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission Required',
          message: 'App needs access to your camera to take photos for shop and products.',
          buttonPositive: 'Allow',
          buttonNegative: 'Cancel',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      return false;
    }
  }
  return true;
};
