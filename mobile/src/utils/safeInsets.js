import { Platform, StatusBar, Dimensions } from 'react-native';

/**
 * Calculates a guaranteed safe top inset for translucent headers and screens.
 * 
 * Accounts for:
 * 1. `StatusBar.currentHeight` on Android (Samsung One UI, Xiaomi, Pixel notches & cutouts)
 * 2. `insets.top` from react-native-safe-area-context
 * 3. Safe minimums (36dp on Android, 20dp on iOS) to prevent text/icons from colliding
 *    with the Android clock, battery, wifi icons, or camera punch hole.
 * 
 * @param {object} insets - Result of useSafeAreaInsets()
 * @param {number} extraPadding - Additional breathing room (default: 10dp)
 * @returns {number} Safe top inset in dp
 */
export function getSafeTopInset(insets = {}, extraPadding = 10) {
  const insetsTop = typeof insets?.top === 'number' ? insets.top : 0;
  const androidBar = Platform.OS === 'android' ? (StatusBar.currentHeight || 36) : 0;
  const baseTop = Math.max(insetsTop, androidBar, Platform.OS === 'android' ? 36 : 20);
  return baseTop + extraPadding;
}

/**
 * Calculates a clean safe bottom inset for screens and tab bars.
 * 
 * Accurately accounts for:
 * 1. `insets.bottom` reported by react-native-safe-area-context (e.g., gesture bar, home indicator)
 * 2. Standard 3-button navigation on Android (where the app window is already bounded above the nav bar,
 *    so no redundant dead-space padding should be injected).
 *
 * @param {object} insets - Result of useSafeAreaInsets()
 * @param {number} extraPadding - Optional additional padding (defaults to 0)
 * @returns {number} Safe bottom inset in dp
 */
export function getSafeBottomInset(insets = {}, extraPadding = 0) {
  const insetsBottom = typeof insets?.bottom === 'number' ? insets.bottom : 0;

  if (Platform.OS === 'android') {
    // When insetsBottom > 0 (gesture bar or edge-to-edge window), respect the inset.
    // When insetsBottom === 0 (standard 3-button nav), the OS already hosts the buttons
    // outside the window; DO NOT add redundant height.
    const resolvedBottom = insetsBottom > 0 ? insetsBottom : 0;
    return resolvedBottom + extraPadding;
  }

  // iOS: Use safe area inset (e.g. 34dp on iPhone X+, 0 on older models)
  const iosBottom = insetsBottom > 0 ? insetsBottom : 0;
  return iosBottom + extraPadding;
}

export default getSafeBottomInset;
