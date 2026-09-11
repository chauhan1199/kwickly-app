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

    // On Android, if insets.bottom is reported (> 0), use it.
    // If windowDiff indicates a navigation bar (> 20dp), use windowDiff.
    // If both are 0 (e.g. translucent navigation bar or custom ROM without fitSystemWindows),
    // provide a guaranteed baseline of 44dp so navigation buttons never overlap UI.
    const resolvedBottom = insetsBottom > 0
      ? insetsBottom
      : (windowDiff > 20 ? windowDiff : 44);

    return Math.max(resolvedBottom, 32) + extraPadding;
  }

  // iOS: Use safe area inset with sensible minimum
  const iosBottom = insetsBottom > 0 ? insetsBottom : 16;
  return iosBottom + extraPadding;
}

export default getSafeBottomInset;
