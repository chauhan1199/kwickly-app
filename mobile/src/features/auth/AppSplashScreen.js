import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const { width: SW, height: SH } = Dimensions.get('window');

const AppSplashScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { userToken, isLoading } = useAuth();

  // Entrance animations
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Radar pulse rings (centered concentric soft aura)
  const pulseRing1 = useRef(new Animated.Value(1.0)).current;
  const pulseRingOpacity1 = useRef(new Animated.Value(0.45)).current;
  const pulseRing2 = useRef(new Animated.Value(1.0)).current;
  const pulseRingOpacity2 = useRef(new Animated.Value(0.45)).current;

  // Gentle centered breathing scale for logo (no off-center bobbing)
  const logoBreath = useRef(new Animated.Value(1.0)).current;

  // Ambient floating background orbs
  const orb1Anim = useRef(new Animated.Value(0)).current;
  const orb2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Logo Entrance
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 45,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Subtle symmetric breathing pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoBreath, {
            toValue: 1.03,
            duration: 1600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(logoBreath, {
            toValue: 0.98,
            duration: 1600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });

    // 2. Concentric Radial Aura Pulse 1
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseRing1, {
            toValue: 1.45,
            duration: 2200,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad),
          }),
          Animated.timing(pulseRingOpacity1, {
            toValue: 0,
            duration: 2200,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseRing1, { toValue: 1.0, duration: 0, useNativeDriver: true }),
          Animated.timing(pulseRingOpacity1, { toValue: 0.45, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();

    // Concentric Radial Aura Pulse 2 (Staggered)
    const ring2Timer = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseRing2, {
              toValue: 1.45,
              duration: 2200,
              useNativeDriver: true,
              easing: Easing.out(Easing.quad),
            }),
            Animated.timing(pulseRingOpacity2, {
              toValue: 0,
              duration: 2200,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseRing2, { toValue: 1.0, duration: 0, useNativeDriver: true }),
            Animated.timing(pulseRingOpacity2, { toValue: 0.45, duration: 0, useNativeDriver: true }),
          ]),
        ])
      ).start();
    }, 1100);

    // 3. Ambient Background Floating Orbs
    Animated.loop(
      Animated.sequence([
        Animated.timing(orb1Anim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orb1Anim, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(orb2Anim, {
          toValue: 1,
          duration: 4500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orb2Anim, {
          toValue: 0,
          duration: 4500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 5. Text entrance
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // 6. Progress bar fill
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2200,
      useNativeDriver: false,
      easing: Easing.inOut(Easing.quad),
    }).start();

    // 7. Navigation after timeout
    const timer = setTimeout(() => {
      if (!isLoading && userToken) {
        // Handled by RootNavigator
      } else {
        navigation.replace('Welcome');
      }
    }, 2400);

    return () => {
      clearTimeout(timer);
      clearTimeout(ring2Timer);
    };
  }, [isLoading, userToken, navigation]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const orb1TranslateY = orb1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -35],
  });
  const orb1TranslateX = orb1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 25],
  });

  const orb2TranslateY = orb2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 40],
  });
  const orb2TranslateX = orb2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -25],
  });

  return (
    <View style={[styles.root, { backgroundColor: isDarkMode ? '#0B0F19' : '#FFFFFF' }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? '#0B0F19' : '#FFFFFF'}
        translucent={false}
      />

      {/* Base Gradient Layer */}
      <LinearGradient
        colors={
          isDarkMode
            ? ['#0B0F19', '#111726', '#0B0F19']
            : ['#FFFFFF', '#F6F8FC', '#EDE9FE', '#FFFFFF']
        }
        locations={[0, 0.4, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ─── AMBIENT BACKGROUND ANIMATED ORBS ─── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ambientOrb1,
          {
            transform: [
              { translateY: orb1TranslateY },
              { translateX: orb1TranslateX },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['#8B5CF6', '#6C47FF']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.ambientOrb2,
          {
            transform: [
              { translateY: orb2TranslateY },
              { translateX: orb2TranslateX },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['#3B82F6', '#8B5CF6']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* ─── CENTER BRANDING CONTENT ─── */}
      <View style={styles.centerContainer}>
        {/* Animated Icon with Dual Radial Aura Rings */}
        <View style={styles.iconBox}>
          {/* Outer Aura Ring 2 */}
          <Animated.View
            style={[
              styles.pulseCircle,
              {
                borderColor: isDarkMode ? '#8B5CF6' : '#C4B5FD',
                backgroundColor: isDarkMode ? 'rgba(139, 92, 246, 0.08)' : 'rgba(196, 181, 253, 0.15)',
                transform: [{ scale: pulseRing2 }],
                opacity: pulseRingOpacity2,
              },
            ]}
          />

          {/* Inner Aura Ring 1 */}
          <Animated.View
            style={[
              styles.pulseCircle,
              {
                borderColor: isDarkMode ? '#6C47FF' : '#7C3AED',
                backgroundColor: isDarkMode ? 'rgba(108, 71, 255, 0.1)' : 'rgba(124, 58, 237, 0.18)',
                transform: [{ scale: pulseRing1 }],
                opacity: pulseRingOpacity1,
              },
            ]}
          />

          {/* Logo Container with Smooth Centered Breathing */}
          <Animated.View
            style={[
              styles.logoBadge,
              {
                opacity: logoOpacity,
                transform: [
                  { scale: Animated.multiply(logoScale, logoBreath) },
                ],
              },
            ]}
          >
            <Image
              source={require('../../assets/logo.png')}
              style={styles.splashLogoImg}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* Brand Title */}
        <Animated.View
          style={[
            styles.titleWrapper,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            },
          ]}
        >
          <Text style={[styles.brandTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>
            Kwick<Text style={{ color: '#6C47FF' }}>ly</Text>
          </Text>
        </Animated.View>

        {/* Tagline */}
        <Animated.View style={[styles.taglineWrapper, { opacity: taglineOpacity }]}>
          <Text style={[styles.taglineText, { color: isDarkMode ? '#94A3B8' : '#475569' }]}>
            Every Service. Anytime. Near You.
          </Text>
        </Animated.View>

        {/* Sleek Gradient Progress Indicator */}
        <Animated.View style={[styles.progressTrack, { opacity: taglineOpacity }]}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progressWidth,
              },
            ]}
          >
            <LinearGradient
              colors={['#7C3AED', '#6C47FF', '#A78BFA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Animated.View>
      </View>

      {/* Footer Branding */}
      <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
        <Text style={[styles.footerText, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
          Fast • Reliable • Multi-Service
        </Text>
        <Text style={[styles.versionText, { color: isDarkMode ? '#475569' : '#CBD5E1' }]}>
          v1.5.8
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 40,
    overflow: 'hidden',
  },
  ambientOrb1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.16,
    overflow: 'hidden',
  },
  ambientOrb2: {
    position: 'absolute',
    bottom: SH * 0.15,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.14,
    overflow: 'hidden',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  iconBox: {
    width: 124,
    height: 124,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pulseCircle: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1.5,
  },
  logoBadge: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogoImg: {
    width: 92,
    height: 92,
  },
  titleWrapper: {
    alignItems: 'center',
    marginTop: 6,
  },
  brandTitle: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
  },
  taglineWrapper: {
    marginTop: 8,
    paddingHorizontal: 20,
  },
  taglineText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  progressTrack: {
    width: 150,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(108, 71, 255, 0.15)',
    marginTop: 36,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
    overflow: 'hidden',
  },
  footer: {
    alignItems: 'center',
    gap: 4,
    zIndex: 2,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  versionText: {
    fontSize: 10,
    fontWeight: '500',
  },
});

export default AppSplashScreen;
