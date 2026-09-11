import { Platform, Dimensions } from 'react-native';

/**
 * Calculates a guaranteed safe bottom inset for screens and components.
 * 
 * Accurately accounts for:
 * 1. `insets.bottom` reported by react-native-safe-area-context
 * 2. Android on-screen 3-button navigation bars (Recents, Home, Back, Accessibility)
 *    calculated from `screen.height - window.height`
 * 3. Fallback minimums (48dp for 3-button nav, 20dp for gesture nav, 16dp for iOS)
 *
 * @param {object} insets - Result of useSafeAreaInsets()
 * @param {number} extraPadding - Optional additional padding (defaults to 0)
 * @returns {number} Safe bottom inset in dp
 */
export function getSafeBottomInset(insets = {}, extraPadding = 0) {
  const insetsBottom = typeof insets?.bottom === 'number' ? insets.bottom : 0;

  if (Platform.OS === 'android') {
    let windowDiff = 0;
    try {
      const screenH = Dimensions.get('screen').height;
      const windowH = Dimensions.get('window').height;
      windowDiff = Math.max(0, screenH - windowH);
    } catch (_) {
      windowDiff = 0;
    }

    // On Android, 3-button and 4-button navigation bars (Recent, Home, Back, Accessibility)
    // require 56dp minimum height so navigation buttons never overlap footer illustrations.
    const resolvedBottom = Math.max(
      insetsBottom,
      windowDiff > 20 ? windowDiff : 0,
      56
    );

    return resolvedBottom + extraPadding;
  }

  // iOS: Use safe area inset with sensible minimum
  const iosBottom = insetsBottom > 0 ? insetsBottom : 16;
  return iosBottom + extraPadding;
}

export default getSafeBottomInset;
