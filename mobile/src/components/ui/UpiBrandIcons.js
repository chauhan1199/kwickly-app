import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Path, Circle, Polygon, Rect, G } from 'react-native-svg';

/**
 * Google Pay stylized brand logo badge
 */
export const GooglePayIcon = ({ size = 36 }) => (
  <View style={[styles.badgeBase, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#FFFFFF' }]}>
    <Svg width={size * 0.7} height={size * 0.7} viewBox="0 0 48 48">
      {/* Google stylized G */}
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  </View>
);

/**
 * PhonePe stylized official brand logo
 */
export const PhonePeIcon = ({ size = 36 }) => (
  <View style={[styles.badgeBase, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#5F259F' }]}>
    <Svg width={size * 0.65} height={size * 0.65} viewBox="0 0 32 32">
      <Path
        fill="#FFFFFF"
        d="M19.5 4H10a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h3.5v-7.5h4.2c4.8 0 8.3-3.4 8.3-8.2 0-5-3.6-8.3-8.5-8.3zm-.3 11.2h-4.2V9.3h4.2c2.2 0 3.7 1.4 3.7 3.4 0 2.1-1.5 3.5-3.7 3.5z"
      />
      <Circle cx="21" cy="23" r="2.8" fill="#00D09C" />
    </Svg>
  </View>
);

/**
 * Paytm stylized official brand badge
 */
export const PaytmIcon = ({ size = 36 }) => (
  <View style={[styles.badgeBase, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' }]}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ fontSize: size * 0.32, fontWeight: '900', color: '#002E6E', letterSpacing: -0.5 }}>Pay</Text>
      <Text style={{ fontSize: size * 0.32, fontWeight: '900', color: '#00BAF2', letterSpacing: -0.5 }}>tm</Text>
    </View>
  </View>
);

/**
 * CRED luxury brand badge
 */
export const CredIcon = ({ size = 36 }) => (
  <View style={[styles.badgeBase, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#111827' }]}>
    <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 32 32">
      <Path
        fill="#FFFFFF"
        d="M16 4C9.373 4 4 9.373 4 16s5.373 12 12 12 12-5.373 12-12S22.627 4 16 4zm0 4a8 8 0 0 1 8 8c0 3.1-1.78 5.78-4.38 7.12V18h-2.19v4.94A7.95 7.95 0 0 1 16 24a8 8 0 0 1-8-8c0-4.418 3.582-8 8-8zm-2 6v6h4v-6h-4z"
      />
    </Svg>
  </View>
);

/**
 * Official BHIM tricolor angle motif
 */
export const BhimIcon = ({ size = 36 }) => (
  <View style={[styles.badgeBase, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' }]}>
    <Svg width={size * 0.72} height={size * 0.72} viewBox="0 0 40 40">
      <Polygon points="6,32 18,8 23,15 13,32" fill="#007A3D" />
      <Polygon points="15,32 27,8 32,15 22,32" fill="#F47920" />
    </Svg>
  </View>
);

/**
 * Official UPI / Any App chevron motif
 */
export const BhimUpiIcon = ({ size = 36 }) => (
  <View style={[styles.badgeBase, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' }]}>
    <Svg width={size * 0.72} height={size * 0.72} viewBox="0 0 40 40">
      <Polygon points="8,32 20,8 24,14 14,32" fill="#F47920" />
      <Polygon points="16,32 28,8 32,14 22,32" fill="#0F7A3E" />
    </Svg>
  </View>
);

export const AnyUpiIcon = BhimUpiIcon;

const styles = StyleSheet.create({
  badgeBase: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
});
