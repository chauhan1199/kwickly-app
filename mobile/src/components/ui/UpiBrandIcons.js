import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Polygon, Text as SvgText } from 'react-native-svg';

/**
 * Google Pay official brand logo badge
 * Matches official "G Pay" branding: White badge with 4-color Google 'G' and 'Pay' wordmark
 */
export const GooglePayIcon = ({ size = 38 }) => (
  <View
    style={[
      styles.badgeBase,
      {
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.2,
        borderColor: '#E2E8F0',
      },
    ]}
  >
    <Svg width={size * 0.82} height={size * 0.52} viewBox="0 0 120 80" fill="none">
      {/* "Pay" wordmark in dark charcoal slate */}
      <Path
        d="M57.54 27V36H63.08C64.4 36 65.49 35.54 66.36 34.65C67.24 33.76 67.69 32.71 67.69 31.49C67.69 30.29 67.24 29.25 66.36 28.36C65.49 27.45 64.4 27 63.08 27H57.54ZM57.54 39.14V49.56H54.23V23.84H63.01C65.24 23.84 67.13 24.58 68.69 26.06C70.28 27.55 71.07 29.36 71.07 31.49C71.07 33.67 70.28 35.49 68.69 36.95C67.16 38.41 65.26 39.14 63.01 39.14H57.54ZM74.41 44.17C74.41 45.03 74.78 45.75 75.51 46.33C76.24 46.9 77.1 47.19 78.08 47.19C79.47 47.19 80.71 46.67 81.8 45.65C82.9 44.61 83.44 43.4 83.44 42.02C82.41 41.2 80.97 40.8 79.12 40.8C77.78 40.8 76.66 41.12 75.76 41.77C74.86 42.41 74.41 43.21 74.41 44.17ZM78.69 31.38C81.14 31.38 83.07 32.03 84.49 33.34C85.9 34.64 86.61 36.44 86.61 38.71V49.56H83.44V47.12H83.3C81.93 49.13 80.11 50.14 77.83 50.14C75.89 50.14 74.26 49.56 72.96 48.41C71.65 47.26 71 45.82 71 44.1C71 42.28 71.69 40.83 73.06 39.75C74.44 38.67 76.28 38.14 78.59 38.14C80.55 38.14 82.17 38.49 83.44 39.21V38.46C83.44 37.31 82.98 36.33 82.07 35.53C81.2 34.74 80.05 34.31 78.87 34.33C77.02 34.33 75.56 35.1 74.48 36.66L71.57 34.83C73.18 32.53 75.55 31.38 78.69 31.38ZM104.77 31.96L93.73 57.32H90.31L94.41 48.45L87.15 31.96H90.74L96 44.6H96.07L101.17 31.95L104.77 31.96Z"
        fill="#3C4043"
      />
      {/* Google 'G' 4-color arcs */}
      <Path
        d="M44.17 36.89C44.17 35.85 44.08 34.85 43.92 33.89H29.96V39.58H37.96C37.62 41.42 36.56 43.04 35 44.08V47.77H39.77C42.56 45.2 44.17 41.39 44.17 36.89Z"
        fill="#4285F4"
      />
      <Path
        d="M29.96 51.34C33.96 51.34 37.32 50.03 39.77 47.77L35 44.08C33.67 44.97 31.96 45.49 29.96 45.49C26.1 45.49 22.82 42.89 21.65 39.39H16.74V43.2C19.25 48.19 24.37 51.34 29.96 51.34"
        fill="#34A853"
      />
      <Path
        d="M21.65 39.39C21.04 37.55 21.04 35.56 21.65 33.73V29.92H16.74C15.7 31.98 15.16 34.25 15.16 36.56C15.16 38.94 15.73 41.2 16.74 43.19L21.65 39.39Z"
        fill="#FBBC05"
      />
      <Path
        d="M29.96 27.63C32.14 27.63 34.1 28.37 35.64 29.84L39.86 25.63C37.3 23.24 33.96 21.78 29.96 21.78C24.37 21.78 19.26 24.93 16.74 29.92L21.66 33.73C22.83 30.23 26.1 27.63 29.96 27.63"
        fill="#EA4335"
      />
    </Svg>
  </View>
);

/**
 * PhonePe official brand logo badge
 * Deep royal purple background (#5F259F) with authentic white Devanagari 'पे' glyph
 */
export const PhonePeIcon = ({ size = 38 }) => (
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
    <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="#FFFFFF">
      <Path d="M10.21 9.94h2.95v4.69c-.4.2-.94.27-1.34.27-1.07 0-1.61-.54-1.61-1.74V9.94zm7.24-1.07a.89.89 0 0 0-.87-.87h-1.61l-3.69-4.22c-.33-.4-.87-.54-1.41-.4l-1.27.4c-.2.07-.27.34-.13.47l4.02 3.82H6.39c-.2 0-.34.13-.34.34v.67c0 .47.4.87.87.87h.94v3.22c0 2.41 1.27 3.82 3.42 3.82.67 0 1.2-.07 1.88-.34v2.15c0 .6.47 1.07 1.07 1.07h.94c.22 0 .4-.18.4-.4V9.87h1.54c.2 0 .34-.13.34-.34v-.67z" />
    </Svg>
  </View>
);

/**
 * Paytm official brand logo badge
 * Sky-blue background (#00BAF2) with dark navy 'pay' and pure white 'tm'
 */
export const PaytmIcon = ({ size = 38 }) => (
  <View
    style={[
      styles.badgeBase,
      {
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: '#00BAF2',
      },
    ]}
  >
    <Svg width={size * 0.78} height={size * 0.44} viewBox="0 0 24 16" fill="none">
      {/* 'pay' in dark navy */}
      <Path
        d="M.23 5.4A.23.23 0 0 0 0 5.64v5.92c0 .13.1.24.22.24h1.09c.13 0 .24-.1.24-.24l.01-1.66h1.01c.86 0 1.45-.6 1.45-1.48V6.88c0-.88-.6-1.48-1.45-1.48H.23zm9.03 0a.24.24 0 0 0-.23.24v2.47c0 .94.65 1.61 1.58 1.61h.67s.02 0 .04 0a.25.25 0 0 1 .22.26c0 .13-.1.23-.22.25l-.02 0-.3.01H9.74a.24.24 0 0 0-.24.24v1.09c0 .13.11.24.24.24h1.75c.92 0 1.58-.67 1.58-1.61V5.64a.24.24 0 0 0-.24-.24h-1.07a.24.24 0 0 0-.24.24c0 .79 0 1.53 0 2.26a.25.25 0 0 1-.25.25h-.45a.25.25 0 0 1-.25-.26c0-.75 0-1.5 0-2.25a.24.24 0 0 0-.24-.24zm-4 0a.23.23 0 0 0-.24.23v1.02c0 .13.11.24.25.24h1.42c.11.02.2.1.21.23v.14c-.01.12-.1.21-.2.22h-.7c-.94 0-1.6.63-1.6 1.52v1.27c0 .88.57 1.5 1.5 1.5h1.94c.34 0 .63-.27.63-.6V7.04c0-1-.5-1.64-1.72-1.64zm-3.72 1.57h.68c.14 0 .25.12.25.26v.83a.25.25 0 0 1-.25.26h-.1c-.2 0-.39 0-.58 0zm4.67 1.98h.45c.14 0 .25.1.25.24v.93a.23.23 0 0 1-.01.08.25.25 0 0 1-.24.16h-.45a.25.25 0 0 1-.25-.24V9.2c0-.13.11-.24.25-.24Z"
        fill="#002970"
      />
      {/* 'tm' in pure white */}
      <Path
        d="M15.85 4.17a.2.2 0 0 0-.04 0c-.68.19-.54 1.15-1.78 1.23h-.12a.23.23 0 0 0-.05 0h0a.24.24 0 0 0-.19.24v1.09c0 .13.11.24.24.24h.65v4.62c0 .13.1.24.23.24h1.06a.24.24 0 0 0 .23-.24V7h.6c.13 0 .24-.1.24-.24V5.67a.24.24 0 0 0-.24-.24h-.61V4.39a.22.22 0 0 0-.22-.22zm4.23 1.17c-.4 0-.76.15-1.04.4v-.13a.24.24 0 0 0-.24-.22h-1.07a.24.24 0 0 0-.23.24v5.92c0 .13.1.24.23.24h1.07c.12 0 .22-.09.24-.21v-4.25a.4.4 0 0 1 .37-.41h.2a.41.41 0 0 1 .22.09.4.4 0 0 1 .15.32v4.07l0 .16a.24.24 0 0 0 .24.24h1.07a.24.24 0 0 0 .23-.23l0-4.25c0-.14.06-.27.18-.34a.42.42 0 0 1 .19-.07h.2c.23.02.37.2.37.41 0 1.4 0 2.8 0 4.22a.24.24 0 0 0 .24.24h1.07c.13 0 .24-.1.24-.24V6.99c0-.31-.03-.44-.08-.58a1.6 1.6 0 0 0-1.51-1.09h-.02a1.58 1.58 0 0 0-1.15.5c-.29-.31-.7-.5-1.15-.5z"
        fill="#FFFFFF"
      />
    </Svg>
  </View>
);

/**
 * BHIM official brand logo badge
 * White background with bold italic dark slate 'BHIM' and Indian tricolor chevrons
 */
export const BhimIcon = ({ size = 38 }) => (
  <View
    style={[
      styles.badgeBase,
      {
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.2,
        borderColor: '#E2E8F0',
      },
    ]}
  >
    <Svg width={size * 0.84} height={size * 0.42} viewBox="0 0 116 40" fill="none">
      {/* BHIM text in bold italic dark slate */}
      <SvgText
        x="2"
        y="30"
        fontFamily="System"
        fontWeight="900"
        fontStyle="italic"
        fontSize="34"
        fill="#263238"
        letterSpacing="-1"
      >
        BHIM
      </SvgText>
      {/* Saffron leading chevron */}
      <Polygon points="86,8 99,8 93,20 80,20" fill="#F47920" />
      {/* Emerald green trailing chevron */}
      <Polygon points="95,21 108,21 102,33 89,33" fill="#0F7A3E" />
    </Svg>
  </View>
);

/**
 * CRED official brand badge
 * Deep black tile (#0F1016) with authentic white geometric CRED shield
 */
export const CredIcon = ({ size = 38 }) => (
  <View
    style={[
      styles.badgeBase,
      {
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: '#0F1016',
        borderWidth: 1.2,
        borderColor: '#1E2230',
      },
    ]}
  >
    <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 32 32" fill="none">
      {/* Outer CRED shield outline */}
      <Path
        d="M8 5h16v12c0 5.5-4.2 9.8-8 11.2-3.8-1.4-8-5.7-8-11.2V5z"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner geometric labyrinth loop */}
      <Path
        d="M13 10h6v6.8c0 2.2-1.4 4.2-3 4.9-1.6-.7-3-2.7-3-4.9v-2.8h3"
        stroke="#FFFFFF"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

/**
 * Official NPCI UPI badge (legacy fallback)
 */
export const AnyUpiIcon = ({ size = 38 }) => (
  <View
    style={[
      styles.badgeBase,
      {
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.2,
        borderColor: '#E2E8F0',
      },
    ]}
  >
    <Svg width={size * 0.54} height={size * 0.44} viewBox="0 0 32 20">
      <Polygon points="6,19 16,2 20,7 11,19" fill="#F47920" />
      <Polygon points="13,19 23,2 27,7 18,19" fill="#0F7A3E" />
    </Svg>
  </View>
);

export const BhimUpiIcon = AnyUpiIcon;

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
  BhimIcon,
  CredIcon,
  AnyUpiIcon,
  BhimUpiIcon,
};
