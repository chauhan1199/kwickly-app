import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Path, Circle, Polygon, Rect, G } from 'react-native-svg';

/**
 * Google Pay official brand logo badge
 * Featuring the authentic 4-color intertwined folded ribbon (Blue, Red, Yellow, Green)
 */
export const GooglePayIcon = ({ size = 36 }) => (
  <View style={[styles.badgeBase, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#FFFFFF' }]}>
    <Svg width={size * 0.76} height={size * 0.76} viewBox="0 0 48 48">
      {/* Top Blue loop */}
      <Path
        fill="#4285F4"
        d="M24 6c-5.52 0-10 4.48-10 10v6h6v-6c0-2.21 1.79-4 4-4s4 1.79 4 4v1.5l5.6-5.6C31.2 8.6 27.8 6 24 6z"
      />
      {/* Top Right Red loop */}
      <Path
        fill="#EA4335"
        d="M34 16c0-5.52-4.48-10-10-10-3.8 0-7.2 2.6-9.6 5.9l5.6 5.6C21.79 16.5 22.8 16 24 16c2.21 0 4 1.79 4 4v6h6v-10z"
      />
      {/* Bottom Yellow loop */}
      <Path
        fill="#FBBC05"
        d="M24 42c5.52 0 10-4.48 10-10v-6h-6v6c0 2.21-1.79 4-4 4s-4-1.79-4-4v-1.5l-5.6 5.6C16.8 39.4 20.2 42 24 42z"
      />
      {/* Bottom Left Green loop */}
      <Path
        fill="#34A853"
        d="M14 32c0 5.52 4.48 10 10 10 3.8 0 7.2-2.6 9.6-5.9l-5.6-5.6c-1.79 1-2.8 1.5-4 1.5-2.21 0-4-1.79-4-4v-6h-6v10z"
      />
    </Svg>
  </View>
);

/**
 * PhonePe official brand logo badge
 * Featuring the authentic white Devanagari 'पे' glyph on official PhonePe purple (#5F259F)
 */
export const PhonePeIcon = ({ size = 36 }) => (
  <View style={[styles.badgeBase, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#5F259F' }]}>
    <Svg width={size * 0.68} height={size * 0.68} viewBox="0 0 32 32">
      {/* Shirorekha (Top horizontal line) */}
      <Rect x="5" y="7.5" width="22" height="2.8" rx="1.4" fill="#FFFFFF" />

      {/* Matra 'े' angled upper stroke */}
      <Path
        d="M17.5 7.5L13.2 2.8C12.7 2.2 11.8 2.2 11.3 2.7C10.8 3.2 10.8 4.1 11.3 4.6L15.2 8.5"
        fill="#FFFFFF"
      />

      {/* Main Pe vertical right stem */}
      <Rect x="18.5" y="8" width="3.2" height="17.5" rx="1.6" fill="#FFFFFF" />

      {/* Pe left curve/loop */}
      <Path
        d="M10.2 9.5v5.8c0 3 2.2 5.2 5.2 5.2h4.5v-3.2h-4.2c-1.3 0-2.3-.9-2.3-2.2V9.5h-3.2z"
        fill="#FFFFFF"
      />

      {/* PhonePe trademark accent circle */}
      <Circle cx="23.5" cy="22" r="2.2" fill="#FFFFFF" />
    </Svg>
  </View>
);

/**
 * Paytm official brand badge
 * Crisp navy 'Pay' and vibrant cyan 'tm'
 */
export const PaytmIcon = ({ size = 36 }) => (
  <View style={[styles.badgeBase, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' }]}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.32, fontWeight: '900', color: '#002E6E', letterSpacing: -0.5 }}>Pay</Text>
      <Text style={{ fontSize: size * 0.32, fontWeight: '900', color: '#00BAF2', letterSpacing: -0.5 }}>tm</Text>
    </View>
  </View>
);

/**
 * CRED official brand badge
 * Sleek dark slate tile (#0F1016) with the authentic white geometric CRED shield
 */
export const CredIcon = ({ size = 36 }) => (
  <View style={[styles.badgeBase, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#0F1016' }]}>
    <Svg width={size * 0.65} height={size * 0.65} viewBox="0 0 32 32">
      {/* Outer CRED shield outline */}
      <Path
        d="M8 5h16v12c0 5.5-4.2 9.8-8 11.2-3.8-1.4-8-5.7-8-11.2V5z"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner geometric labyrinth loop */}
      <Path
        d="M13 10h6v6.8c0 2.2-1.4 4.2-3 4.9-1.6-.7-3-2.7-3-4.9v-2.8h3"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

/**
 * Official BHIM tricolor brand motif
 */
export const BhimIcon = ({ size = 36 }) => (
  <View style={[styles.badgeBase, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' }]}>
    <Svg width={size * 0.75} height={size * 0.75} viewBox="0 0 40 40">
      {/* Left green triangle */}
      <Polygon points="7,32 18,8 23,15 13,32" fill="#007A3D" />
      {/* Right saffron triangle */}
      <Polygon points="16,32 27,8 32,15 22,32" fill="#F47920" />
    </Svg>
  </View>
);

/**
 * Official NPCI UPI Chevron badge
 */
export const BhimUpiIcon = ({ size = 36 }) => (
  <View style={[styles.badgeBase, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' }]}>
    <Svg width={size * 0.75} height={size * 0.75} viewBox="0 0 40 40">
      {/* Saffron leading chevron */}
      <Polygon points="8,32 20,8 24,14 14,32" fill="#F47920" />
      {/* Green trailing chevron */}
      <Polygon points="16,32 28,8 32,14 22,32" fill="#0F7A3E" />
    </Svg>
  </View>
);

export const AnyUpiIcon = BhimUpiIcon;

/**
 * Official WhatsApp Pay badge
 */
export const WhatsAppIcon = ({ size = 36 }) => (
  <View style={[styles.badgeBase, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#25D366' }]}>
    <Svg width={size * 0.65} height={size * 0.65} viewBox="0 0 32 32">
      <Path
        fill="#FFFFFF"
        d="M16 3C8.82 3 3 8.82 3 16c0 2.47.69 4.78 1.88 6.75L3.5 28.5l6.02-1.34C11.37 28.24 13.61 29 16 29c7.18 0 13-5.82 13-13S23.18 3 16 3zm6.39 17.58c-.28.78-1.61 1.48-2.22 1.57-.57.09-1.29.13-3.69-.87-2.9-1.2-4.75-4.14-4.89-4.34-.14-.2-1.18-1.57-1.18-2.99 0-1.42.74-2.12 1-2.41.26-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.66.5.24.58.83 2.02.9 2.17.07.15.12.33.02.53-.1.2-.15.32-.3.49-.15.17-.32.38-.45.52-.15.15-.3.32-.13.62.17.29.76 1.25 1.63 2.02 1.12.99 2.06 1.3 2.36 1.44.29.15.47.13.64-.07.18-.2.76-.89.96-1.19.2-.3.4-.25.68-.15.28.1 1.77.83 2.07.98.3.15.5.23.57.35.07.13.07.74-.21 1.52z"
      />
    </Svg>
  </View>
);

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
