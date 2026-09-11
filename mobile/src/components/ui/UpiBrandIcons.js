import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Path, Circle, Polygon, Rect } from 'react-native-svg';

/**
 * Google Pay official brand logo badge
 * Featuring the authentic official 4-color Google 'G' (Red, Blue, Yellow, Green)
 */
export const GooglePayIcon = ({ size = 36 }) => (
  <View
    style={[
      styles.badgeBase,
      {
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
      },
    ]}
  >
    <Svg width={size * 0.68} height={size * 0.68} viewBox="0 0 48 48">
      {/* Top Red arc */}
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      {/* Right Blue bar & arc */}
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      {/* Left Yellow arc */}
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      {/* Bottom Green arc */}
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  </View>
);

/**
 * PhonePe official brand logo badge
 * Featuring the authentic white Devanagari 'पे' glyph on official PhonePe purple (#5F259F)
 */
export const PhonePeIcon = ({ size = 36 }) => (
  <View
    style={[
      styles.badgeBase,
      {
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: '#5F259F',
      },
    ]}
  >
    <Svg width={size * 0.7} height={size * 0.7} viewBox="0 0 32 32">
      {/* Top Shirorekha */}
      <Rect x="5" y="7" width="22" height="3" rx="1.5" fill="#FFFFFF" />

      {/* Matra 'े' angled upper stroke */}
      <Path
        d="M17.5 7L13 2.5C12.4 1.9 11.4 1.9 10.8 2.5C10.2 3.1 10.2 4 10.8 4.6L14.8 8.6"
        fill="#FFFFFF"
      />

      {/* Main Pe vertical right stem */}
      <Rect x="18" y="7.5" width="3.4" height="18" rx="1.7" fill="#FFFFFF" />

      {/* Pe left curve/loop */}
      <Path
        d="M9.8 9v6.2c0 3.2 2.4 5.4 5.5 5.4h4.5v-3.4h-4.2c-1.4 0-2.4-1-2.4-2.4V9H9.8z"
        fill="#FFFFFF"
      />

      {/* PhonePe trademark accent dot */}
      <Circle cx="23.5" cy="22" r="2.2" fill="#FFFFFF" />
    </Svg>
  </View>
);

/**
 * Paytm official brand badge
 * Crisp navy 'Pay' and vibrant cyan 'tm'
 */
export const PaytmIcon = ({ size = 36 }) => (
  <View
    style={[
      styles.badgeBase,
      {
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        justifyContent: 'center',
        alignItems: 'center',
      },
    ]}
  >
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
      <Text
        style={{
          fontSize: size * 0.34,
          fontWeight: '900',
          color: '#002970',
          letterSpacing: -0.6,
        }}
      >
        Pay
      </Text>
      <Text
        style={{
          fontSize: size * 0.34,
          fontWeight: '900',
          color: '#00BAF2',
          letterSpacing: -0.6,
        }}
      >
        tm
      </Text>
    </View>
  </View>
);

/**
 * CRED official brand badge
 * Sleek dark slate tile (#0F1016) with the authentic white geometric CRED shield
 */
export const CredIcon = ({ size = 36 }) => (
  <View
    style={[
      styles.badgeBase,
      {
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: '#0F1016',
        borderWidth: 1,
        borderColor: '#1E2230',
      },
    ]}
  >
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
 * BHIM official brand badge
 * Deep navy blue tile with crisp white bold 'BHIM' lettering and tricolor saffron/green accent slash
 */
export const BhimIcon = ({ size = 36 }) => (
  <View
    style={[
      styles.badgeBase,
      {
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: '#002855',
        borderWidth: 1,
        borderColor: '#003A7A',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
      },
    ]}
  >
    <Text
      style={{
        color: '#FFFFFF',
        fontSize: size * 0.28,
        fontWeight: '900',
        fontStyle: 'italic',
        letterSpacing: -0.5,
        marginRight: 2,
      }}
    >
      BHIM
    </Text>
    {/* Tricolor diagonal accent stripes */}
    <Svg width={size * 0.24} height={size * 0.52} viewBox="0 0 10 24">
      <Polygon points="3,1 10,1 7,11 0,11" fill="#FF9933" />
      <Polygon points="3,13 10,13 7,23 0,23" fill="#138808" />
    </Svg>
  </View>
);

/**
 * Official NPCI UPI badge ("Any UPI App")
 * Featuring the authentic NPCI orange/green chevrons with bold 'UPI' wordmark below
 */
export const AnyUpiIcon = ({ size = 36 }) => (
  <View
    style={[
      styles.badgeBase,
      {
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 2,
      },
    ]}
  >
    {/* Dual NPCI Chevrons */}
    <Svg width={size * 0.54} height={size * 0.44} viewBox="0 0 32 20">
      {/* Saffron leading chevron */}
      <Polygon points="6,19 16,2 20,7 11,19" fill="#F47920" />
      {/* Green trailing chevron */}
      <Polygon points="13,19 23,2 27,7 18,19" fill="#0F7A3E" />
    </Svg>
    <Text
      style={{
        fontSize: size * 0.22,
        fontWeight: '900',
        color: '#1B365D',
        letterSpacing: 0.8,
        lineHeight: size * 0.26,
      }}
    >
      UPI
    </Text>
  </View>
);

export const BhimUpiIcon = AnyUpiIcon;

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

export default {
  GooglePayIcon,
  PhonePeIcon,
  PaytmIcon,
  CredIcon,
  BhimIcon,
  AnyUpiIcon,
  BhimUpiIcon,
  WhatsAppIcon,
};
