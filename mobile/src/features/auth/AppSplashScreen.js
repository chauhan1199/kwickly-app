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
  const { userToken, userRole, isLoading } = useAuth();

  // Animation values
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const pulseRing = useRef(new Animated.Value(0.8)).current;
  const pulseRingOpacity = useRef(new Animated.Value(0.6)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Logo Pop & Glow
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.5)),
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Pulse Ring
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseRing, {
            toValue: 1.4,
            duration: 1200,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad),
          }),
          Animated.timing(pulseRingOpacity, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseRing, {
            toValue: 0.8,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(pulseRingOpacity, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    // 3. Text entrance
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

    // 4. Progress bar fill
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
      easing: Easing.inOut(Easing.quad),
    }).start();

    // 5. Navigate after 2.3 seconds
    const timer = setTimeout(() => {
      if (!isLoading) {
        if (userToken) {
          // Handled by RootNavigator if logged in
        } else {
          navigation.replace('Welcome');
        }
      } else {
        navigation.replace('Welcome');
      }
    }, 2300);

    return () => clearTimeout(timer);
  }, [isLoading, userToken, navigation]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.root, { backgroundColor: isDarkMode ? '#0B0F19' : '#FFFFFF' }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? '#0B0F19' : '#FFFFFF'}
        translucent={false}
      />

      {/* Elegant Background Gradient */}
      <LinearGradient
        colors={
          isDarkMode
            ? ['#0B0F19', '#111726', '#0B0F19']
            : ['#FFFFFF', '#F6F8FC', '#EDE9FE', '#FFFFFF']
        }
        locations={[0, 0.4, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Center Branding Content */}
      <View style={styles.centerContainer}>
        {/* Glowing Animated Icon Container */}
        <View style={styles.iconBox}>
          {/* Animated Pulse Ring */}
          <Animated.View
            style={[
              styles.pulseCircle,
              {
                borderColor: isDarkMode ? '#6C47FF' : '#8B5CF6',
                transform: [{ scale: pulseRing }],
                opacity: pulseRingOpacity,
              },
            ]}
          />

          {/* Logo Container */}
          <Animated.View
            style={[
              styles.logoBadge,
              {
                backgroundColor: isDarkMode ? '#131B2E' : '#FFFFFF',
                shadowColor: '#6C47FF',
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
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

        {/* Sleek Loading Progress Indicator */}
        <Animated.View style={[styles.progressTrack, { opacity: taglineOpacity }]}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progressWidth,
                backgroundColor: '#6C47FF',
              },
            ]}
          />
        </Animated.View>
      </View>

      {/* Footer Branding */}
      <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
        <Text style={[styles.footerText, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
          Fast • Reliable • Multi-Service
        </Text>
        <Text style={[styles.versionText, { color: isDarkMode ? '#475569' : '#CBD5E1' }]}>
          v1.0.0
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
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  pulseCircle: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
  },
  logoBadge: {
    width: 90,
    height: 90,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(108, 71, 255, 0.2)',
  },
  splashLogoImg: {
    width: 64,
    height: 64,
  },
  titleWrapper: {
    alignItems: 'center',
    marginTop: 4,
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
    width: 140,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(108, 71, 255, 0.15)',
    marginTop: 36,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  footer: {
    alignItems: 'center',
    gap: 4,
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
